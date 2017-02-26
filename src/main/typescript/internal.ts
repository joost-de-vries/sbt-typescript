
/** this file contains code that has no dependencies on external modules */
const path = require("path")
require("es6-shim")

class Logger {
    public isDebug:boolean

    constructor(public logLevel:string) {
        this.isDebug = "debug" === this.logLevel
    }

    debug(message:string, object?:any) {
        if (this.logLevel === "debug" && object)console.log(message, object)
        else if (this.logLevel === "debug") console.log(message)
    }

    info(message:string) {
        if (this.logLevel === "debug" || this.logLevel === "debug") console.log(message)
    }

    warn(message:string) {
        if (this.logLevel === "debug" || this.logLevel === "info" || this.logLevel === "warn") console.log(message)
    }

    error(message:string, error?:any) {
        if (this.logLevel === "debug" || this.logLevel === "info" || this.logLevel === "warn" || this.logLevel === "error") {
            if (error !== undefined) {
                let errorMessage = error.message
                if (error.fileName !== undefined) {
                    errorMessage = errorMessage + " in " + error.fileName
                }
                if (error.lineNumber !== undefined) {
                    errorMessage = errorMessage + " at line " + error.lineNumber
                }
                console.log(message + " " + errorMessage)
            } else {
                console.log(message)
            }
        }
    }
}

interface Option<T> {
    value?: T
    foreach(f:(t:T)=>any): any
    map<B> (f:(t:T)=>B):Option<B>

}

class Some<T> {
    constructor(public value:T) {
    }

    foreach(f:(t:T)=>any) {
        return f(this.value)
    }

    map<B>(f:(t:T)=>B):Option<B> {
        return new Some(f(this.value))
    }
}
class None<T> implements Option<T> {
    foreach(f:(t:T)=>any) {
        return
    }

    map<B>(f:(t:T)=>B):Option<B> {
        return new None<B>()
    }
}

class SourceMapping {
    public absolutePath:string
    public relativePath:string

    constructor(a:string[]) {
        this.absolutePath = a[0]
        this.relativePath = a[1]
    }

    normalizedAbsolutePath():string {
        return path.normalize(this.absolutePath)
    }

    toOutputPath(targetDir:string, extension:string) {
        return path.join(targetDir,
            replaceFileExtension(path.normalize(this.relativePath), extension)
        )
    }
}

class SourceMappings {
    public mappings:SourceMapping[]
    private absolutePaths:string[]
    private relativePaths:string[]

    constructor(sourceFileMappings:string[][]) {
        this.mappings = sourceFileMappings.map((a)=> new SourceMapping(a))
    }

    asAbsolutePaths():string[] {
        if (!this.absolutePaths) {
            this.absolutePaths = this.mappings.map((sm)=> sm.normalizedAbsolutePath())
        }
        return this.absolutePaths
    }

    asRelativePaths():string[] {
        if (!this.relativePaths) {
            this.relativePaths = this.mappings.map((sm)=> sm.relativePath)
        }
        return this.relativePaths
    }
    find(sourceFileName:string):Option<SourceMapping> {
        const absPath = path.normalize(sourceFileName)
        const index = this.asAbsolutePaths().indexOf(absPath)
        if (index !== -1) {
            return new Some(this.mappings[index])

        } else {
//            logger.error("did not find '"+absPath+"'")
            return new None()
        }
    }
}

interface CompilationFileResult {
    source: string
    result: {
        filesRead: string[]
        filesWritten: string[]
    }
}

interface CompilationResult {
    results: CompilationFileResult[]
    problems: Problem[]
}

function compileDone(compileResult:CompilationResult) {
    // datalink escape character https://en.wikipedia.org/wiki/C0_and_C1_control_codes#DLE
    // used to signal result of compilation see https://github.com/sbt/sbt-js-engine/blob/master/src/main/scala/com/typesafe/sbt/jse/SbtJsTask.scala
    console.log("\u0010" + JSON.stringify(compileResult))
}

interface Problem {
    lineNumber: number
    characterOffset: number
    message: string
    source: string
    severity: string
    lineContent: string
}

/** interfacing with sbt */
// from jstranspiler
function parseArgs(args:string[]):Args {

    const SOURCE_FILE_MAPPINGS_ARG = 2
    const TARGET_ARG = 3
    const OPTIONS_ARG = 4

    const cwd = process.cwd()

    let sourceFileMappings:string[][]
    try {
        sourceFileMappings = JSON.parse(args[SOURCE_FILE_MAPPINGS_ARG])
    } catch (e) {
        sourceFileMappings = [[
            path.join(cwd, args[SOURCE_FILE_MAPPINGS_ARG]),
            args[SOURCE_FILE_MAPPINGS_ARG]
        ]]
    }

    let target = (args.length > TARGET_ARG ? args[TARGET_ARG] : path.join(cwd, "lib"))

    let options:SbtTypescriptOptions
    if (target.length > 0 && target.charAt(0) === "{") {
        options = JSON.parse(target)
        target = path.join(cwd, "lib")
    } else {
        options = (args.length > OPTIONS_ARG ? JSON.parse(args[OPTIONS_ARG]) : {})
    }

    return <Args>{
        sourceFileMappings: sourceFileMappings,
        target: target,
        options: options
    }
}

interface Args {
    sourceFileMappings:string[][]
    target:string
    options:SbtTypescriptOptions
}

interface SbtTypescriptOptions {
    logLevel:string,
    tsconfig:any,
    tsconfigDir:string,
    assetsDirs:string[],
    tsCodesToIgnore:number[],
    extraFiles:string[],
    nodeModulesDirs:string[],
    resolveFromNodeModulesDir:boolean,
    assertCompilation:boolean
}

function replaceFileExtension(file:string, ext:string) {
    let oldExt = path.extname(file)
    return file.substring(0, file.length - oldExt.length) + ext
}
