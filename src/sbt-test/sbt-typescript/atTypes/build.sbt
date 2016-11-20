



lazy val root = (project in file(".")).enablePlugins(SbtWeb)

JsEngineKeys.engineType := JsEngineKeys.EngineType.Node

libraryDependencies ++= Seq(
  "org.webjars.npm" % "types__moment" % "2.11.26-alpha",
  "org.webjars.npm" % "moment" % "2.11.2"
)
resolveFromWebjarsNodeModulesDir := true


logLevel in typescript := Level.Debug
