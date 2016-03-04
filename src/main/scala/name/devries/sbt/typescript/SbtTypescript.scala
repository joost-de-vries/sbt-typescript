package name.devries.sbt.typescript

import java.io.File

import com.typesafe.sbt.jse.JsEngineImport.JsEngineKeys
import com.typesafe.sbt.jse.SbtJsTask
import com.typesafe.sbt.web.PathMapping
import com.typesafe.sbt.web.pipeline.Pipeline
import sbt.Project.Initialize
import sbt._
import sbt.Keys._
import spray.json._
import com.typesafe.sbt.jse.SbtJsTask.autoImport.JsTaskKeys._
import com.typesafe.sbt.web.Import.WebKeys._
import com.typesafe.sbt.web.SbtWeb.autoImport._

object SbtTypescript extends AutoPlugin with JsonProtocol {

  override def requires = SbtJsTask

  override def trigger = AllRequirements

  /** the public api to a projects build.sbt*/
  object autoImport {
    val typescript = TaskKey[Seq[File]]("typescript", "Run Typescript compiler")

    val projectFile = SettingKey[File]("typescript-projectfile",
      "The location of the tsconfig.json  Default: <basedir>/tsconfig.json")

    val typingsFile = SettingKey[Option[File]]("typescript-typings-file", "A file that refers to typings that the build needs. Default None.")

    val tsCodesToIgnore = SettingKey[List[Int]]("typescript-codes-to-ignore",
      "The tsc error codes (f.i. TS2307) to ignore. Default empty list.")

    val canNotFindModule = 2307 //see f.i. https://github.com/Microsoft/TypeScript/issues/3808

    val resolveFromWebjarsNodeModulesDir = SettingKey[Boolean]("typescript-resolve-modules-from-etc","Will use the directory to resolve modules ")
    val typescriptStage = Def.taskKey[Pipeline.Stage]("Create outfile in stage")
  }

  val getTsConfig = TaskKey[JsObject]("get-tsconfig", "parses the tsconfig.json file")
  val typescriptWrapperTask = TaskKey[Seq[File]]("typescript-wrapper-task", "Wraps the typescript task to do post processing.")

  import autoImport._

  // wrt to out vs outFile see https://github.com/Microsoft/TypeScript/issues/5107
  val typescriptUnscopedSettings = Seq(
    includeFilter := GlobFilter("*.ts") | GlobFilter("*.tsx"),
    excludeFilter := GlobFilter("*.d.ts"),
    jsOptions := JsObject(Map(
      "logLevel" -> JsString(logLevel.value.toString),
      "tsconfig" -> parseTsConfig().value,
      "tsconfigDir" -> JsString(projectFile.value.getParent),
      "assetsDir" -> JsString((sourceDirectory in Assets).value.getAbsolutePath),
      "tsCodesToIgnore" -> JsArray(tsCodesToIgnore.value.toVector.map(JsNumber(_))),
      "nodeModulesDir" -> JsString(webJarsNodeModulesDirectory.value.getAbsolutePath),
      "resolveFromNodeModulesDir" -> JsBoolean(resolveFromWebjarsNodeModulesDir.value)
    ) ++ optionalFields(Map("extraFiles" -> typingsFile.value.map(tf => JsArray(JsString(tf.getCanonicalPath)))))
    ).toString()
  )

  override def projectSettings = Seq(
    tsCodesToIgnore := List.empty[Int],
    projectFile := baseDirectory.value / "tsconfig.json",
    typingsFile := None,
    resolveFromWebjarsNodeModulesDir := false,
    logLevel in typescript := Level.Info,
    typescriptWrapperTask in Assets:= moveFiles().value,
    typescriptWrapperTask in TestAssets:= moveFiles().value,
    JsEngineKeys.parallelism := 1
  ) ++ inTask(typescript)(
    SbtJsTask.jsTaskSpecificUnscopedSettings ++
      inConfig(Assets)(typescriptUnscopedSettings) ++
      inConfig(TestAssets)(typescriptUnscopedSettings) ++
      Seq(
        moduleName := "typescript",
        shellFile := getClass.getClassLoader.getResource("typescript.js"),

        taskMessage in Assets := "Typescript compiling",
        taskMessage in TestAssets := "Typescript test compiling"
      )
  ) ++ addJsSourceFileTasks() ++ Seq(
    typescript in Assets := (typescript in Assets).dependsOn(webJarsNodeModules in Assets).value,
    typescript in TestAssets := (typescript in TestAssets).dependsOn(webJarsNodeModules in TestAssets).value
  )

  /** adapted from SbtJsTask.addJsSourceFileTasks */
  def addJsSourceFileTasks(): Seq[Setting[_]] = {
    Seq(
      sourceDependencies in typescript := Nil,
      typescript in Assets := SbtJsTask.jsSourceFileTask(typescript, Assets).dependsOn(nodeModules in Plugin).value,
      typescript in TestAssets := SbtJsTask.jsSourceFileTask(typescript, TestAssets).dependsOn(nodeModules in Plugin).value,
      resourceManaged in typescript in Assets := webTarget.value / typescript.key.label / "main",
      resourceManaged in typescript in TestAssets := webTarget.value / typescript.key.label / "test",
      typescript := (typescript in Assets).value
    ) ++
      inConfig(Assets)(addUnscopedJsSourceFileTasks()) ++
      inConfig(TestAssets)(addUnscopedJsSourceFileTasks())
  }

  /** adapted from SbtJsTask.addUnscopedJsSourceFileTasks */
  private def addUnscopedJsSourceFileTasks(): Seq[Setting[_]] = {
    Seq(
      resourceGenerators <+= typescriptWrapperTask,
      managedResourceDirectories += (resourceManaged in typescript).value
    ) ++ inTask(typescript)(Seq(
      managedSourceDirectories ++= Def.settingDyn { sourceDependencies.value.map(resourceManaged in _).join }.value,
      managedSources ++= Def.taskDyn { sourceDependencies.value.join.map(_.flatten) }.value,
      sourceDirectories := unmanagedSourceDirectories.value ++ managedSourceDirectories.value,
      sources := unmanagedSources.value ++ managedSources.value
    ))
  }

  def moveFiles() = Def.task {
    val compiledFiles = typescript.value
    //streams.value.log.info("received files"+compiledFiles)
    val relAssetsPath = (sourceDirectory in Assets).value.relativeTo(baseDirectory.value)

    val targetPath = (resourceManaged in typescript in Assets).value
      // input is target/web/typescript/main/src/main/assets/x/y output is target/web/typescript/main/x/y
      val copyMappings:Seq[(File,File)] = compiledFiles.map(f => {
        val relativeToPath =targetPath / relAssetsPath.get.getPath
        val relFilePath = f relativeTo relativeToPath

        streams.value.log.debug(s"file $f relative to $relativeToPath is $relFilePath")
        val targetFile = targetPath / relFilePath.get.getPath
        (f, targetFile)
      })
      IO.copy(copyMappings).toSeq
  }

  def parseTsConfig() = Def.task {
    val tsConfigFile = projectFile.value

    val content = IO.read(tsConfigFile)

    JsonParser(removeComments(content))
  }

  def removeComments(string: String) = {
    // cribbed from http://blog.ostermiller.org/find-comment
    string.replaceAll("""/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+/""", "")
  }

  def optionalFields(m: Map[String, Option[JsValue]]): Map[String, JsValue] = {
    m.flatMap { case (s, oj) => oj match {
      case None => Map.empty[String, JsValue]
      case Some(jsValue) => Map(s -> jsValue)
    }
    }
  }
  def scalaJSProdTask: Def.Initialize[Task[Pipeline.Stage]] = Def.task { mappings: Seq[PathMapping] =>
    includeFilter
    mappings ++ prodFiles(Compile).value ++ sourcemapScalaFiles(fullOptJS).value
  }
}
