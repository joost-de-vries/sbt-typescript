sbt-typescript[![Build Status](https://travis-ci.org/joost-de-vries/sbt-typescript.png?branch=master)](https://travis-ci.org/joost-de-vries/sbt-typescript)
==============


An sbt plugin to compile typescript that uses exclusively the `tsconfig.json` file for configuration.  
Also with this plugin the `outFile` typescript compiler option works.  

To use this plugin use the addSbtPlugin command within your project's plugins.sbt (or as a global setting) i.e.:

    addSbtPlugin("name.de-vries" % "sbt-typescript" % "0.2.0")

Your project's build file also needs to enable sbt-web plugins. For example with build.sbt:

    lazy val root = (project in file(".")).enablePlugins(SbtWeb)
    
    
todo:
add .d.ts files from webjars
if outfile normalise path
