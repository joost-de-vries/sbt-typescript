



lazy val root = (project in file(".")).enablePlugins(SbtWeb)

JsEngineKeys.engineType := JsEngineKeys.EngineType.Node

logLevel in typescript := Level.Debug

assertCompilation in typescript := true
