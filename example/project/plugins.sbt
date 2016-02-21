lazy val root = Project("plugins", file(".")).dependsOn(plugin)

lazy val plugin = file("../").getCanonicalFile.toURI
//logLevel := Level.Debug
resolvers ++= Seq(
    Resolver.sbtPluginRepo("releases"),
    Resolver.mavenLocal,
    Resolver.sonatypeRepo("releases"),
    Resolver.typesafeRepo("releases")
)
