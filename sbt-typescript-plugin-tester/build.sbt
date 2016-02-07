import devries.sbt.typescript.SbtTypescript.autoImport._



lazy val root = (project in file(".")).enablePlugins(SbtWeb)

JsEngineKeys.engineType := JsEngineKeys.EngineType.Node

