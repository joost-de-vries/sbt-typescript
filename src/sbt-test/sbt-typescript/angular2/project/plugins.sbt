addSbtPlugin("name.de-vries" % "sbt-typescript" % sys.props("project.version"))

//logLevel := Level.Debug
resolvers ++= Seq(
    Resolver.sbtPluginRepo("releases"),
    Resolver.mavenLocal,
    Resolver.sonatypeRepo("releases"),
    Resolver.typesafeRepo("releases")
)

