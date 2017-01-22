


lazy val root = (project in file(".")).enablePlugins(SbtWeb)
  .aggregate(web, common)

lazy val common = (project in file("modules/common"))
  .enablePlugins(SbtWeb)
  .settings(commonSettings)

lazy val web = (project in file("modules/web"))
  .enablePlugins(SbtWeb)
  .settings(commonSettings)
  .dependsOn(common)

lazy val commonSettings = Seq(
  JsEngineKeys.engineType := JsEngineKeys.EngineType.Node,
  logLevel in typescript := Level.Debug,
  assertCompilation in typescript := true,
  resolveFromWebjarsNodeModulesDir := true,
  excludeFilter in Assets := (excludeFilter in Assets).value || "*.ts"
)

libraryDependencies ++= Seq(
)


