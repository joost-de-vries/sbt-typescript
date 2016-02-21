


lazy val root = (project in file(".")).enablePlugins(SbtWeb)

JsEngineKeys.engineType := JsEngineKeys.EngineType.Node

libraryDependencies ++= Seq(
  "org.webjars.npm" % "angular2" % "2.0.0-beta.7",
  "org.webjars.npm" % "systemjs" % "0.19.20",
  "org.webjars.npm" % "rxjs" % "5.0.0-beta.2",
  "org.webjars.npm" % "es6-promise" % "3.0.2",
  "org.webjars.npm" % "es6-shim" % "0.34.1",
  "org.webjars.npm" % "reflect-metadata" % "0.1.2",
  "org.webjars.npm" % "zone.js" % "0.5.15"
)
logLevel in typescript := Level.Debug

typingsFile := Some(baseDirectory.value / "typings" / "browser.d.ts")
resolveFromWebjarsNodeModulesDir := true