package name.devries.sbt.typescript

import com.typesafe.sbt.jse.JsEngineImport.JsEngineKeys
import com.typesafe.sbt.jse.SbtJsTask
import com.typesafe.sbt.web.{CompileProblems, LineBasedProblem}
import sbt.Keys._
import sbt._
import spray.json.{JsonParser, JsString, JsBoolean, JsObject,pimpAny}
import xsbti.Severity
import com.typesafe.sbt.jse.SbtJsEngine.autoImport.JsEngineKeys._
import com.typesafe.sbt.jse.SbtJsTask.autoImport.JsTaskKeys._
import com.typesafe.sbt.web.Import.WebKeys._
import com.typesafe.sbt.web.SbtWeb.autoImport._

import scala.collection.mutable
import scala.collection.mutable.ListBuffer

object SbtTypescript extends AutoPlugin with JsonProtocol {

  override def requires = SbtJsTask

  override def trigger = AllRequirements

  object autoImport {
    val typescript = TaskKey[Seq[File]]("typescript", "Run Typescript compiler")

    val projectFile = SettingKey[File]("typescript-projectfile",
      "The location of the tsconfig.json  Default: <basedir>/tsconfig.json")
    val getTsConfig = TaskKey[JsObject]("get-tsconfig", "parses the tsconfig.json file")
  }

  import autoImport._

  // wrt to out vs outFile see https://github.com/Microsoft/TypeScript/issues/5107
  val typescriptUnscopedSettings = Seq(
    includeFilter := GlobFilter("*.ts") | GlobFilter("*.tsx"),
    excludeFilter := GlobFilter("*.d.ts"),
    projectFile := baseDirectory.value / "tsconfig.json",
    jsOptions := JsObject(Map(
      "logLevel" -> JsString("debug"),
      "tsconfig" ->parseTsConfig().value ,
      "tsconfigFilename" -> JsString(projectFile.value.getParent)
    )).toString(),
    JsEngineKeys.parallelism := 1
  )

  override def projectSettings = Seq(
    //outDir := ((webTarget in Assets).value / "typescript").absolutePath,
    JsEngineKeys.parallelism := 1,
    logLevel := Level.Info
  ) ++ inTask(typescript)(
    SbtJsTask.jsTaskSpecificUnscopedSettings ++
      inConfig(Assets)(typescriptUnscopedSettings) ++
      inConfig(TestAssets)(typescriptUnscopedSettings) ++
      Seq(
        moduleName := "typescript",
        shellFile := getClass.getClassLoader.getResource("typescript.js"),

        taskMessage in Assets := "TypeScript compiling",
        taskMessage in TestAssets := "TypeScript test compiling"
      )
  ) ++ SbtJsTask.addJsSourceFileTasks(typescript) ++ Seq(
    typescript in Assets := (typescript in Assets).dependsOn(webModules in Assets).value,
    typescript in TestAssets := (typescript in TestAssets).dependsOn(webModules in TestAssets).value
  )


  def parseTsConfig() = Def.task {
    val tsConfigFile = projectFile.value

    val content = IO.read(tsConfigFile)

    JsonParser(content)
  }

  def validate(tsConfig: TsConfig) = {
    val errors = ListBuffer.empty[String]
    def msg(elName: String) = s"$elName would be ignored. Please remove the element."
    def validate(att: Option[String], name: String) = if (att.nonEmpty) errors += msg(name)
    if (tsConfig.exclude.isDefined) errors += msg("exclude")
    if (tsConfig.files.isDefined) errors += msg("exclude")
    tsConfig.compilerOptions.foreach { co =>
      validate(co.out, "out")
      validate(co.outDir, "outDir")
      validate(co.outFile, "outFile")
      validate(co.rootDir, "rootDir")

    }

    if (errors.nonEmpty) throw new IllegalArgumentException(errors.mkString(","))
  }


}