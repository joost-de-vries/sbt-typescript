package name.devries.sbt.typescript


import com.typesafe.sbt.jse.JsEngineImport.JsEngineKeys
import com.typesafe.sbt.jse.SbtJsTask
import com.typesafe.sbt.jse.SbtJsTask.autoImport.JsTaskKeys._
import com.typesafe.sbt.web.Import.WebKeys._
import com.typesafe.sbt.web.PathMapping
import com.typesafe.sbt.web.SbtWeb.autoImport._
import com.typesafe.sbt.web.pipeline.Pipeline
import sbt.Keys._
import sbt.{File, _}
import spray.json.{JsArray, JsString, _}


/** typescript compilation can run during 'sbt assets' compilation or during Play 'sbt stage' as a sbt-web pipe */
sealed class CompileMode(val value: String) {
  override def toString = value
}

object CompileMode {

  case object Compile extends CompileMode("compile")

  case object Stage extends CompileMode("stage")

  val values: Set[CompileMode] = Set(Compile, Stage)
  val parse = values.map(v => v.value -> v).toMap
}

object SbtTypescript extends AutoPlugin with JsonProtocol {

  override def requires = SbtJsTask

  override def trigger = AllRequirements

  /** the public api to a projects build.sbt */
  object autoImport {
    val typescript = TaskKey[Seq[File]]("typescript", "Run Typescript compiler")

    val projectFile = SettingKey[File]("typescript-projectfile",
      "The location of the tsconfig.json  Default: <basedir>/tsconfig.json")

    val projectTestFile = SettingKey[Option[String]]("typescript-test-projectfile",
      "The location of the tsconfig.json for test code.  For instance: <basedir>/tsconfig.test.json")

    val typingsFile = SettingKey[Option[File]]("typescript-typings-file", "A file that refers to typings that the build needs. Default None.")

    val tsCodesToIgnore = SettingKey[List[Int]]("typescript-codes-to-ignore",
      "The tsc error codes (f.i. TS2307) to ignore. Default empty list.")

    val canNotFindModule = 2307 //see f.i. https://github.com/Microsoft/TypeScript/issues/3808

    val resolveFromWebjarsNodeModulesDir = SettingKey[Boolean]("typescript-resolve-modules-from-etc", "Will use the directory to resolve modules ")

    val typescriptPipe = Def.taskKey[Pipeline.Stage]("typescript-pipe")
    val outFile = SettingKey[String]("typescript-out-file", "the name of the outfile that the stage pipe will produce. Default 'main.js' ")

    val compileMode = SettingKey[CompileMode]("typescript-compile-mode", "the compile mode to use if no jvm argument is provided. Default 'Compile'")

    val setupTscCompilation = TaskKey[Unit]("setup-tsc-compilation", "Setup tsc compilation. For example to get your IDE to compilate typescript.")

    val assertCompilation = SettingKey[Boolean]("typescript-asserts", "for debugging purposes: asserts that tsc produces the expected files")

  }

  val getTsConfig = TaskKey[JsObject]("get-tsconfig", "parses the tsconfig.json file")

  val getCompileMode = TaskKey[CompileMode]("get-compile-mode", "determines required compile mode")

  import autoImport._

  override def buildSettings = inTask(typescript)(
    SbtJsTask.jsTaskSpecificUnscopedBuildSettings ++ Seq(
      moduleName := "typescript",
      shellFile := getClass.getClassLoader.getResource("typescript.js")
    )
  )

  override def projectSettings = Seq(
    // default settings
    tsCodesToIgnore := List.empty[Int],
    projectFile := baseDirectory.value / "tsconfig.json",
    projectTestFile := None, //baseDirectory.value / "tsconfig.test.json",
    typingsFile := None,
    resolveFromWebjarsNodeModulesDir := false,
    logLevel in typescript := Level.Info,
    typescriptPipe := typescriptPipeTask.value,
    JsEngineKeys.parallelism := 1,
    compileMode := CompileMode.Compile,
    getCompileMode := getCompileModeTask.value,
    outFile := "main.js",
    setupTscCompilation := setupTsCompilationTask().value,
    assertCompilation := false
  ) ++ inTask(typescript)(
    SbtJsTask.jsTaskSpecificUnscopedProjectSettings ++
      inConfig(Assets)(typescriptUnscopedSettings(Assets)) ++
      inConfig(TestAssets)(typescriptUnscopedSettings(TestAssets)) ++
      Seq(
        taskMessage in Assets := "Typescript compiling",
        taskMessage in TestAssets := "Typescript test compiling"
      )
  ) ++ SbtJsTask.addJsSourceFileTasks(typescript) ++ Seq(
    typescript in Assets := (typescript in Assets).dependsOn(webJarsNodeModules in Assets).value,
    typescript in TestAssets := (typescript in TestAssets).dependsOn(webJarsNodeModules in TestAssets).value
  )

  def typescriptUnscopedSettings(config: Configuration) = {

    def optionalFields(m: Map[String, Option[JsValue]]): Map[String, JsValue] = {
      m.flatMap { case (s, oj) => oj match {
        case None => Map.empty[String, JsValue]
        case Some(jsValue) => Map(s -> jsValue)
      }
      }
    }

    def toJsArray(mainDir: String, testDir: String) = {
      if (config == Assets) {
        JsArray(JsString(mainDir))
      } else if (config == TestAssets) {
        JsArray(JsString(mainDir), JsString(testDir))
      } else {
        throw new IllegalStateException
      }
    }

    Seq(
      includeFilter := GlobFilter("*.ts") | GlobFilter("*.tsx"),
      excludeFilter := GlobFilter("*.d.ts"),
      // the options that we provide to our js task
      jsOptions := JsObject(Map(
        "logLevel" -> JsString(logLevel.value.toString),
        "tsconfig" -> parseTsConfig().value,
        "tsconfigDir" -> JsString(projectFile.value.getParent),
        "assetsDirs" -> toJsArray(
          mainDir = (sourceDirectory in Assets).value.getAbsolutePath,
          testDir = (sourceDirectory in TestAssets).value.getAbsolutePath
        ),
        "tsCodesToIgnore" -> JsArray(tsCodesToIgnore.value.toVector.map(JsNumber(_))),
        "nodeModulesDirs" -> toJsArray(
          mainDir = (webJarsNodeModulesDirectory in Assets).value.getAbsolutePath,
          testDir = (webJarsNodeModulesDirectory in TestAssets).value.getAbsolutePath),
        "resolveFromNodeModulesDir" -> JsBoolean(resolveFromWebjarsNodeModulesDir.value),
        "runMode" -> JsString(getCompileMode.value.toString),
        "assertCompilation" -> JsBoolean(assertCompilation.value)
      ) ++ optionalFields(Map(
        "extraFiles" -> typingsFile.value.map(tf => JsArray(JsString(tf.getCanonicalPath)))
      )
      )
      ).toString()
    )
  }

  /** a convenience task to copy webjar npms to the standard ./node_modules directory */
  def setupTsCompilationTask() = Def.task {
    def copyPairs(baseDir: File, modules: Seq[File]): Seq[(File, File)] = {
      modules
        .flatMap(f => IO.relativizeFile(baseDir, f).map(rf => Seq((f, rf))).getOrElse(Seq.empty))
        .map { case (f, rf) => (f, baseDirectory.value / "node_modules" / rf.getPath) }
    }

    val assetCopyPairs = copyPairs(
      (webJarsNodeModulesDirectory in Assets).value,
      (webJarsNodeModules in Assets).value
    )

    val testAssetCopyPairs = copyPairs(
      (webJarsNodeModulesDirectory in TestAssets).value,
      (webJarsNodeModules in TestAssets).value
    )

    IO.copy(assetCopyPairs ++ testAssetCopyPairs)
    streams.value.log.info(s"Webjars copied to ./node_modules")
    ()
  }

  /** parse our tsconfig.json and replace the properties that we manage. Ie outDir viz outFile */
  def parseTsConfig() = Def.task {

    def removeComments(string: String) = {
      JsonCleaner.minify(string)
    }

    def parseJson(tsConfigFile: File): JsValue = {
      val content = IO.read(tsConfigFile)

      JsonParser(removeComments(content))
    }

    def fixJson(tsConfigFile: File) = {
      val tsConfigObject = parseJson(tsConfigFile).asJsObject
      val newTsConfigObject = for {
        coJsValue <- tsConfigObject.fields.get("compilerOptions") if getCompileMode.value == CompileMode.Stage

        co = coJsValue.asJsObject
        newCo = JsObject(co.fields - "outDir" ++ Map("outFile" -> JsString(outFile.value)))
      } yield JsObject(tsConfigObject.fields ++ Map("compilerOptions" -> newCo))
      newTsConfigObject.getOrElse(tsConfigObject)

    }


    val defaultTsConfig = fixJson(projectFile.value)
    val testTsConfigOverrides = projectTestFile.value
      .map(fileName => baseDirectory.value / fileName)
      .map { file => parseJson(file).asJsObject
      }
    testTsConfigOverrides.map(overrides =>JsonUtil.merge(defaultTsConfig, overrides))
      .getOrElse(defaultTsConfig)
  }

  def getCompileModeTask = Def.task {
    val modeOpt = for {
      s <- sys.props.get("tsCompileMode")
      cm <- CompileMode.parse.get(s)
    } yield cm

    modeOpt.getOrElse(compileMode.value)
  }

  def typescriptPipeTask: Def.Initialize[Task[Pipeline.Stage]] = Def.task {
    inputMappings =>

      val isTypescript: PathMapping => Boolean = {
        case (file, path) => (includeFilter in typescript in Assets).value.accept(file)
      }
      val minustypescriptMappings = inputMappings.filterNot(isTypescript)
      streams.value.log.debug(s"running typescript pipe")

      minustypescriptMappings
  }

}

object JsonUtil {
  def merge(tsConfig: JsObject, tsConfigOverride: JsObject): JsObject = {
    val keys = tsConfig.fields.keySet ++ tsConfigOverride.fields.keySet
    val merged = keys.map { key =>
      (for {v1 <- tsConfig.getFields(key).headOption
            v2 <- tsConfigOverride.getFields(key).headOption
      } yield {
        v2 match {
          case JsNull => key -> JsNull
          case v: JsString => key -> v
          case v: JsBoolean => key -> v
          case v: JsNumber => key -> v
          case v: JsArray => v1 match {
            case JsArray(elements) => key -> JsArray(elements ++ v.elements)
            case other => throw new IllegalArgumentException(s"can't override $key with $v value with $other")
          }
          case v: JsObject => key -> new JsObject(v1.asJsObject.fields ++ v.fields)
        }

      }).orElse(tsConfig.getFields(key).headOption.map(key -> _)).orElse(tsConfigOverride.getFields(key).headOption.map(key -> _))

    }
    new JsObject(merged.flatten.toMap)
  }
}