#sbt-typescript [![Build Status](https://travis-ci.org/joost-de-vries/sbt-typescript.png?branch=master)](https://travis-ci.org/joost-de-vries/sbt-typescript)
This sbt plugin compiles the Typescript code in your Play application to javascript fit for consumption by your average browser and device.  
  
###introduction
The aim of this plugin is to make it easy to write Angular2 applications using the Play framework.  
As such it
 - [x] allows transpiling to a single output file. This is important for large applications. At least for as long as http2 isn't prevalent.
 - [x] uses the standard `tsconfig.json` file for configuration. Most editors and IDEs use this file to resolve types in the typescript code you're writing. Also it has the advantage of allowing you to switch between `sbt-typescript` and `tsc`. And it allows setting of all `tsc` options. Even the undocumented ones.
 - [x] allows resolution of module imports against webjars. Since every Angular2 application uses ES6 module imports this is obviously an important requirement.
 - [x] allows for including typings files in the build. This is essential for compilation to ES5 because the standard ES5 lib doesn't have some types that f.i. Angular2 needs. These types are offered for ES5 by ao ES6-shims.
 - [x] allows for suppression of compilation errors. This may seem strange to people coming from conventional statically typed languages. But the `tsc` lives in an untyped world. So it _will_ emit perfectly functional code even if some types can't be checked. Suppression of a specific error is particularly useful if one's using a library for which type information is not available. 
 - [x] uses Typescript 1.8.2
 - [x] JS parts are written in Typescript.
 
###getting started with Typescript and Angular2
I've made an activator tutorial template to get you started. If you have activator installed you can run `activator new play-angular2-typescript`.  Or you can just clone the [repo](https://github.com/joost-de-vries/play-angular2-typescript).  
 
###configuring
Create a `tsconfig.json` file in the root of your project with the required [compiler options](https://github.com/Microsoft/TypeScript/wiki/Compiler-Options).  
Add the following line to your `project\plugins.sbt`:

    addSbtPlugin("name.de-vries" % "sbt-typescript" % "0.2.1_02")

If your project is not a Play application it will have to enable `sbt-web` in `build.sbt`:

    lazy val root = (project in file(".")).enablePlugins(SbtWeb)
    
####typings
If you have a [typings](https://github.com/typings/typings) file you can add it like this:

    typingsFile := Some(baseDirectory.value / "typings" / "browser.d.ts")
    
See `src/sbt-test/sbt-typescript/es6-es5` for an example.  

####resolve against webjar npms
If you want to resolve modules against [webjar npm](http://www.webjars.org/npm)s:

    resolveFromWebjarsNodeModulesDir := true
    
This will use the npm webjar directory to resolve types of modules. See `src/sbt-test/sbt-typescript/angular2` for an example. Make sure to use npm webjars as your dependencies.  

####import modules without type information
If you are importing modules for which you don't have the typings you can ignore the TS2307 `can not find module` error:

    tsCodesToIgnore := List(canNotFindModule)
    
####ignored compiler options
The following `tsc` compiler options are managed by `sbt-typescript` so setting them in `tsconfig.json` has no effect: 
 - `outDir` and 
 - `rootDir`.  

##status
The plugin is young. Currently it is mostly tested against `EngineType.Node`.  
There are some other features I'm planning to implement.

##history
I started this plugin because the features I mentioned above were [missing](https://github.com/ArpNetworking/sbt-typescript/issues/1) in the [existing](https://github.com/ArpNetworking/sbt-typescript/issues/31) [plugins](https://github.com/ArpNetworking/sbt-typescript/issues/23#issuecomment-158099296).  
And since I'd like Play and sbt(-web) to be kickass build tools for Typescript and Angular2 applications, and I wanted to give back to the open source community, I thought I'd implement it myself.. But not by writing javascript if I could just as well write Typescript...   
Kudos to Brendan Arp for his [javascript tsc driver](https://github.com/ArpNetworking/sbt-typescript/blob/master/src/main/resources/typescriptc.js) to get me started. And also to all of the other plugins mentioned [here](https://github.com/sbt/sbt-web). Open source is an amazing tool for collective learning. Just imagine those poor programmers in the 1970s with only IBM manuals to provide them with information.

###release notes

#### v2.2.0 
- upgrades to typescript 1.8.2
- improves output of single outfile
- fixes a nasty bug in module resolution. This is essential for angular2 applications.
