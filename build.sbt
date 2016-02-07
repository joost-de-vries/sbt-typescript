sbtPlugin := true
organization := "name.de-vries"
name := "sbt-typescript"
version := "0.1"

homepage := Some(url("https://github.com/joost-de-vries/sbt-typescript"))
licenses += ("Apache-2.0", url("http://www.apache.org/licenses/LICENSE-2.0"))

scalaVersion := "2.10.4"
scalacOptions += "-feature"

libraryDependencies ++= Seq(
  "org.webjars.npm" % "typescript" % "1.7.5",
  "com.typesafe" % "jstranspiler" % "1.0.0"
)

resolvers ++= Seq(
  "Typesafe Releases Repository" at "http://repo.typesafe.com/typesafe/releases/",
  Resolver.url("sbt snapshot plugins", url("http://repo.scala-sbt.org/scalasbt/sbt-plugin-snapshots"))(Resolver.ivyStylePatterns),
  Resolver.sonatypeRepo("snapshots"),
  "Typesafe Snapshots Repository" at "http://repo.typesafe.com/typesafe/snapshots/",
  Resolver.mavenLocal
)

addSbtPlugin("com.typesafe.sbt" % "sbt-js-engine" % "1.1.3")

publishMavenStyle := false
bintrayRepository in bintray := "sbt-plugins"
bintrayOrganization in bintray := None
bintrayVcsUrl := Some("git@github.com:joost-de-vries/sbt-typescript.git")

scriptedSettings
scriptedLaunchOpts <+= version apply { v => s"-Dproject.version=$v" }
