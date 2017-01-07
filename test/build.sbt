


lazy val root = (project in file(".")).enablePlugins(SbtWeb)

JsEngineKeys.engineType := JsEngineKeys.EngineType.Node

logLevel in typescript := Level.Debug

assertCompilation in typescript := true


jasmineFilter in jasmine := GlobFilter("*Test.js") | GlobFilter("*Spec.js") | GlobFilter("*.spec.js")
logLevel in jasmine := Level.Info

libraryDependencies ++= Seq(
  "org.webjars.npm" % "types__jasmine" % "2.5.40"
)

resolveFromWebjarsNodeModulesDir := true