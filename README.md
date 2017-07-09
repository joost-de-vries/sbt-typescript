# sbt-typescript 

[![Build Status](https://travis-ci.org/joost-de-vries/sbt-typescript.png?branch=master)](https://travis-ci.org/joost-de-vries/sbt-typescript)

This sbt plugin compiles the Typescript code in your Play application to javascript fit for consumption by your average browser and device. It's especially aimed at Angular2 applications.  

### Getting started
The easiest way to get started is to use the dem projects for [Angular2](https://github.com/joost-de-vries/play-angular2-typescript) or [React](https://github.com/joost-de-vries/play-reactjs-typescript). You can create the Angular2 application locally by running `sbt new joost-de-vries/play-angular-typescript.g8`. The React application is hasn't been ported to g8 yet so you'll have to clone it.  
See the [Typescript 2.0 Handbook](https://github.com/Microsoft/TypeScript-Handbook/blob/master/pages/Compiler%20Options.md) for `tsc` options to use in your `tsconfig.json`.
   
### Configuring
Create a `tsconfig.json` file in the root of your project with the required [compiler options](https://github.com/Microsoft/TypeScript/wiki/Compiler-Options).  
Add the following line to your `project\plugins.sbt`:

    addSbtPlugin("name.de-vries" % "sbt-typescript" % "2.4.1-2")

If your project is not a Play application it will have to enable `sbt-web` in `build.sbt`:

    lazy val root = (project in file(".")).enablePlugins(SbtWeb)

#### Configuring an IDE
If you want to use an IDE like IntelliJ you can use the task `sbt setupTscCompilation`. At this point that copies the npm webjars to `<base-dir>/node_modules`. Then you can point the IDE to your `tsconfig.json`.

Make sure `tsc` is configured to find the locations of the npm webjars. See the example repo for the `tsconfig.json` configurations to use.
    
#### Compiling to a single js file
You can develop using individual javascript files when running `sbt ~run` in Play and have your whole typescript application concatenated into a single javascript output file for your stage environment without changes to your sources. To do that you have to add a `-DtsCompileMode=stage` parameter to the sbt task in your CI that creates the stage app. So for Play that will often be `sbt stage -DtsCompileMode=stage`.  
    
#### Type declarations
You can just import type declarations as npm packages from `@types`. For example `@types/jasmine`.

Typings are deprecated.

#### Resolve against webjar npms
If you want to resolve modules against [webjar npm](http://www.webjars.org/npm)s:

    resolveFromWebjarsNodeModulesDir := true
    
This will use the npm webjar directory to resolve types of modules. See `src/sbt-test/sbt-typescript/angular2` for an example. Make sure to use npm webjars as your dependencies.  

#### import modules without type information
If you are importing modules for which you don't have the typings you can ignore the TS2307 `can not find module` error:

    tsCodesToIgnore := List(canNotFindModule)
    
#### ignored compiler options
The following `tsc` compiler options are managed by `sbt-typescript` so setting them in `tsconfig.json` has no effect: 
 - `outDir` and 
 - `rootDir`.  
If you use the `stage` compile mode the `outFile` option is also managed by `sbt-typescript`.  

### override tsconfig.json for test code

    (projectTestFile in typescript) := Some("tsconfig.test.json")

Any settings in that file will override those in `tsconfig.json`  

## release notes

#### v2.4.1-2
- upgrade to sbt-js-engine 1.2.1 and sbt-web 1.4.1
- add correct typeRoots values to tsconfig.json for resolution of @types type def dependencies

#### v2.4.1-1
- allow for overrides of the tsconfig.json for test code

#### v2.4.1
- upgrade to ts npm 2.4.1

#### v2.3.2
- upgrade to ts npm 2.3.2

#### v2.3.1
- upgrade to ts 2.3 final: npm 2.3.1
- sbt-typescript follows the typescript version

#### v0.3.0-beta.11
- upgrade to ts 2.3.0
- fixes readme. Tx [camilosampedro](https://github.com/camilosampedro)

#### v0.3.0-beta.10
- upgrade to ts 2.2.1
- [fixes running on Trireme](https://github.com/joost-de-vries/sbt-typescript/issues/19) Tx [VeryBueno](https://github.com/VeryBueno)!

#### v0.4.0-alfa.1
- supports multi project builds. Uses sbt-web webModules for js deps resolution instead of nodeModules. 
Hence the alfa moniker to see whether f.i. @types resolution still works.

#### v0.3.0-beta.9
- fixes compilation of test assets

#### v0.3.0-beta.8-1
- allows configuring outfile with a path
- makes compile errors 1 based instead of 0 based

#### v0.3.0-beta.8
- upgrades to typescript 2.1 (npm 2.1.4)

#### v0.3.0-beta.7
- upgrades to typescript 2.1 RC (npm 2.1.1)
- resolves webjar @types type definitions

#### v0.3.0-beta.6
- upgrades to typescript 2.0.6

#### v0.3.0-beta.5
- solves an issue (#9) where RxJs would cause a nullpointer. 
- uses typescript 2.0.3

#### v0.3.0-beta.4
- solves an issue (#9) where RxJs would be extracted to the wrong directory. 

#### v0.3.0-beta.3
- uses typescript 2.0 RC (npm 2.0.2)

#### v0.3.0-beta.2
- uses typescript 2.0 beta (npm 2.0.0)

#### v0.3.0SNAPSHOT 
- uses standard typescript functionality to resolve against webjars. Instead of the previous custom rolled module resolution extension.
- uses a snapshot of the upcoming typescript 2.0
- add output assertion options

#### v0.2.7
- adds convenience task for setting up tsc compilation

#### v0.2.6
- fixes jstaskfailure error

#### v0.2.5
- allows for developing using individual javascript files and using a single javascript file in production

#### v0.2.4
- upgrades to typescript 1.8.10

#### v0.2.3
- upgrades to typescript 1.8.7
- adds support for tests in typescript

#### v0.2.2 
- upgrades to typescript 1.8.2
- improves output of single outfile
- fixes a nasty bug in module resolution. This is essential for angular2 applications.
- gives feedback on faulty compiler options.

## status
The plugin is young. Currently it is mostly tested against `EngineType.Node` and Angular2 applications with npm style dependencies.  
There are some other features I'm planning to implement.

## history
I started this plugin because the features I mentioned above were [missing](https://github.com/ArpNetworking/sbt-typescript/issues/1) in the [existing](https://github.com/ArpNetworking/sbt-typescript/issues/31) [plugins](https://github.com/ArpNetworking/sbt-typescript/issues/23#issuecomment-158099296).  
And since I'd like Play and sbt(-web) to be kickass build tools for Typescript and Angular2 applications, and I wanted to give back to the open source community, I thought I'd implement it myself.. But not by writing javascript if I could just as well write Typescript...   
Kudos to Brendan Arp for his [javascript tsc driver](https://github.com/ArpNetworking/sbt-typescript/blob/master/src/main/resources/typescriptc.js) to get me started. And also to all of the other plugins mentioned [here](https://github.com/sbt/sbt-web). Open source is an amazing tool for collective learning. Just imagine those poor programmers in the 1970s with only IBM manuals to provide them with information.

