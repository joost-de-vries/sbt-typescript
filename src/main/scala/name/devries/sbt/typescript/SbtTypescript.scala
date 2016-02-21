package name.devries.sbt.typescript

import java.io.File

import com.typesafe.sbt.jse.JsEngineImport.JsEngineKeys
import com.typesafe.sbt.jse.SbtJsTask
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
  }

  val getTsConfig = TaskKey[JsObject]("get-tsconfig", "parses the tsconfig.json file")

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
  ) ++ SbtJsTask.addJsSourceFileTasks(typescript) ++ Seq(
    typescript in Assets := (typescript in Assets).dependsOn(webJarsNodeModules in Assets).value,
    typescript in TestAssets := (typescript in TestAssets).dependsOn(webJarsNodeModules in TestAssets).value
  )

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
}
