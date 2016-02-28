



lazy val root = (project in file(".")).enablePlugins(SbtWeb)

JsEngineKeys.engineType := JsEngineKeys.EngineType.Node

typingsFile := Some(baseDirectory.value / "typings" / "browser.d.ts")

logLevel in typescript := Level.Debug
