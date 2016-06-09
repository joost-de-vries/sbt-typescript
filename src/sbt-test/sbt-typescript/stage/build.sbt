



lazy val root = (project in file(".")).enablePlugins(SbtWeb)

pipelineStages := Seq(typescriptPipe)

JsEngineKeys.engineType := JsEngineKeys.EngineType.Node

logLevel in typescript := Level.Debug

val expected = Set("javascripts/main.js", "javascripts/main.js.map",
  "javascripts") map(_.replace("/", java.io.File.separator))

val checkMappings = taskKey[Unit]("check the pipeline mappings")

checkMappings := {
  val mappings = WebKeys.pipeline.value
  val paths = (mappings map (_._2)).toSet
  if (paths != expected) sys.error(s"Expected $expected but pipeline paths are $paths")
}

javaOptions ++= {
  Seq("-DtsCompileMode=stage")
}
