sbtPlugin := true
organization := "name.de-vries"
name := "sbt-typescript"
version := "2.6.1"

homepage := Some(url("https://github.com/joost-de-vries/sbt-typescript"))
licenses +=("Apache-2.0", url("http://www.apache.org/licenses/LICENSE-2.0"))

scalaVersion := (CrossVersion partialVersion sbtCrossVersion.value match {
  case Some((0, 13)) => "2.10.6"
  case Some((1, _))  => "2.12.3"
  case _             => sys error s"Unhandled sbt version ${sbtCrossVersion.value}"
})

crossSbtVersions := Seq("0.13.16", "1.0.1")

val sbtCrossVersion = sbtVersion in pluginCrossBuild

updateOptions := updateOptions.value.withCachedResolution(cachedResoluton = true)

scalacOptions ++= Seq(
  "-feature",
  "-encoding", "UTF8",
  "-deprecation",
  "-unchecked",
  "-target:jvm-1.7",
  "-Xlint",
  "-Ywarn-dead-code",
  "-Ywarn-adapted-args"
)

libraryDependencies ++= Seq(

  // js dependencies
  "org.webjars.npm" % "typescript" % "2.6.1",
  "org.webjars.npm" % "minimatch" % "3.0.0",
  "org.webjars.npm" % "fs-extra" % "0.26.6",
  "org.webjars.npm" % "es6-shim" % "0.35.1"
)

dependencyOverrides ++= Seq(
  "org.webjars" % "webjars-locator" % "0.32",
  "org.webjars" % "webjars-locator-core" % "0.32",

  "org.webjars" % "npm" % "3.9.3"
)

resolvers ++= Seq(
  Resolver.bintrayRepo("webjars","maven"),
  Resolver.typesafeRepo("releases"),
  Resolver.sbtPluginRepo("releases"),
  Resolver.sonatypeRepo("releases"),
  Resolver.mavenLocal
)

addSbtPlugin("com.typesafe.sbt" % "sbt-js-engine" % "1.2.2")
addSbtPlugin("com.typesafe.sbt" % "sbt-web" % "1.4.2")

publishMavenStyle := false
bintrayRepository in bintray := "sbt-plugins"
bintrayOrganization in bintray := None
bintrayVcsUrl := Some("git@github.com:joost-de-vries/sbt-typescript.git")

scriptedLaunchOpts += s"-Dproject.version=${version.value}"
scriptedBufferLog := false