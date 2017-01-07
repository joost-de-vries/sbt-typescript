lazy val root = Project("plugins", file(".")).dependsOn(plugin)


addSbtPlugin("name.de-vries" % "sbt-jasmine" % "0.0.1SNAPSHOT")

lazy val plugin = file("../").getCanonicalFile.toURI
//logLevel := Level.Debug
resolvers ++= Seq(
  Resolver.sbtPluginRepo("releases"),
  Resolver.mavenLocal,
  Resolver.sonatypeRepo("releases"),
  Resolver.typesafeRepo("releases")
)
