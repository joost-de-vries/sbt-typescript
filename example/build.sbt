


lazy val root = (project in file(".")).enablePlugins(SbtWeb)

pipelineStages := Seq(typescriptPipe)

JsEngineKeys.engineType := JsEngineKeys.EngineType.Node

logLevel in typescript := Level.Debug

