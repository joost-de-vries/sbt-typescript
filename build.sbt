sbtPlugin := true
organization := "name.de-vries"
name := "sbt-typescript"
version := "0.2.5"

homepage := Some(url("https://github.com/joost-de-vries/sbt-typescript"))
licenses +=("Apache-2.0", url("http://www.apache.org/licenses/LICENSE-2.0"))

scalaVersion := "2.10.6"
scalacOptions ++= Seq(
  "-feature",
  "-encoding", "UTF8",
  "-deprecation",
  "-unchecked",
  "-Xlint",
  "-Ywarn-dead-code",
  "-Ywarn-adapted-args"
)
libraryDependencies ++= Seq(
  "org.webjars.npm" % "typescript" % "1.8.10",
  "org.webjars" % "mkdirp" % "0.3.5"
)

resolvers ++= Seq(
  Resolver.typesafeRepo("releases"),
  Resolver.sbtPluginRepo("releases"),
  Resolver.sonatypeRepo("releases"),
  Resolver.mavenLocal
)

addSbtPlugin("com.typesafe.sbt" % "sbt-js-engine" % "1.1.3")

publishMavenStyle := false
bintrayRepository in bintray := "sbt-plugins"
bintrayOrganization in bintray := None
bintrayVcsUrl := Some("git@github.com:joost-de-vries/sbt-typescript.git")

scriptedSettings
scriptedLaunchOpts <+= version apply { v => s"-Dproject.version=$v" }
