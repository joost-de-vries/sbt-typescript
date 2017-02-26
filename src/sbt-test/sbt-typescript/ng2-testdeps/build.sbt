


lazy val root = (project in file(".")).enablePlugins(SbtWeb)

JsEngineKeys.engineType := JsEngineKeys.EngineType.Node

logLevel in typescript := Level.Debug

libraryDependencies ++= Seq(
  "org.webjars.npm" % "angular2" % "2.0.0-beta.7",
  "org.webjars.npm" % "systemjs" % "0.19.20",
  "org.webjars.npm" % "rxjs" % "5.0.0-beta.2",
  "org.webjars.npm" % "reflect-metadata" % "0.1.2",
  "org.webjars.npm" % "zone.js" % "0.5.15",
  "org.webjars.npm" % "types__jasmine" % "2.5.43"
)

resolveFromWebjarsNodeModulesDir := true