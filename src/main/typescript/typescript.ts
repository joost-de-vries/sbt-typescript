/* global process, require */
/// <reference path="../../../typings/main.d.ts" />
// inspired by https://github.com/ArpNetworking/sbt-typescript/blob/master/src/main/resources/typescriptc.js
import {Program,Diagnostic,SourceFile,CompilerOptions,DiagnosticMessageChain,DiagnosticCategory,CompilerHost,ResolvedModule,ScriptTarget} from "typescript"

const fs = require("fs")
const ts = require("typescript");
const path = require("path");


class Logger {
    public isDebug:boolean

    constructor(public logLevel:string) {
        this.isDebug = 'debug' === this.logLevel
    }

    debug(message:string, object?:any) {
        if (this.logLevel === 'debug' && object)console.log(message, object)
        else if (this.logLevel === 'debug') console.log(message)
    }

    info(message:string) {
        if (this.logLevel === 'debug' || this.logLevel === 'info') console.log(message);
    }

    warn(message:string) {
        if (this.logLevel === 'debug' || this.logLevel === 'info' || this.logLevel === 'warn') console.log(message);
    }

    error(message:string, error?:any) {
        if (this.logLevel === 'debug' || this.logLevel === 'info' || this.logLevel === 'warn' || this.logLevel === 'error') {
            if (error !== undefined) {
                let errorMessage = error.message;
                if (error.fileName !== undefined) {
                    errorMessage = errorMessage + " in " + error.fileName;
                }
                if (error.lineNumber !== undefined) {
                    errorMessage = errorMessage + " at line " + error.lineNumber;
                }
                console.log(message + " " + errorMessage);
            } else {
                console.log(message);
            }
        }
    }
}

const args:Args = parseArgs(process.argv);
const sbtTypescriptOpts:SbtTypescriptOptions = args.options

const logger = new Logger(sbtTypescriptOpts.logLevel);
const logModuleResolution = false

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

    map<B> (f:(t:T)=>B):Option<B> {
        return new Some(f(this.value))
    }
}
class None<T> implements Option<T> {
    foreach(f:(t:T)=>any) {
    }

    map<B> (f:(t:T)=>B):Option<B> {
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
        );
    }
}

class SourceMappings {
    public mappings:SourceMapping[]
    private absolutePaths:string[]

    constructor(sourceFileMappings:string[][]) {
        this.mappings = sourceFileMappings.map((a)=> new SourceMapping(a))
    }

    asAbsolutePaths():string[] {
        if (!this.absolutePaths) {
            this.absolutePaths = this.mappings.map((sm)=> sm.normalizedAbsolutePath())
        }
        return this.absolutePaths
    }


    find(sf:SourceFile):Option<SourceMapping> {
        const absPath = path.normalize(sf.fileName)
        const index = this.asAbsolutePaths().indexOf(absPath)
        if (index != -1) {
            return new Some(this.mappings[index])

        } else {
//            logger.error("did not find '"+absPath+"'")
            return new None()
        }
    }
}

const sourceMappings = new SourceMappings(args.sourceFileMappings)

logger.debug("starting compilation of ", sourceMappings.mappings.map((sm)=> sm.relativePath));
logger.debug("from ", sbtTypescriptOpts.assetsDir);
logger.debug("to ", args.target)
logger.debug("args ", args)

const compileResult = compile(sourceMappings, sbtTypescriptOpts, args.target)
compileDone(compileResult)

function compile(sourceMaps:SourceMappings, options:SbtTypescriptOptions, target:string):CompilationResult {
    const problems:Problem[] = []
    const targetDir = determineTargetAssetsDir(options)

    const unparsedCompilerOptions:any = options.tsconfig["compilerOptions"]
    //logger.debug("compilerOptions ", unparsedCompilerOptions)
        if (unparsedCompilerOptions.outFile) {
        const outFile = path.join(targetDir,path.basename(unparsedCompilerOptions.outFile))
        logger.debug("single outFile ",outFile)
        unparsedCompilerOptions.outFile= outFile
        }
        unparsedCompilerOptions.rootDir = options.tsconfigDir
    const tsConfig = ts.convertCompilerOptionsFromJson(unparsedCompilerOptions, options.tsconfigDir, "tsconfig.json");
    let results:CompilationFileResult[] = []
    if (tsConfig.errors.length > 0) {
        logger.debug("errors during parsing of compilerOptions", tsConfig.errors)
        problems.push(...toProblems(tsConfig.errors, options.tsCodesToIgnore))
    }
    else {
        tsConfig.options.outDir = target;

        let resolutionDirs:string[] = []
        if (sbtTypescriptOpts.resolveFromNodeModulesDir) resolutionDirs.push(sbtTypescriptOpts.nodeModulesDir)
        logger.debug("using tsc options ", tsConfig.options);
        const compilerHost = createCompilerHost(tsConfig.options, resolutionDirs);

        let filesToCompile = sourceMaps.asAbsolutePaths()
        if (sbtTypescriptOpts.extraFiles) filesToCompile = filesToCompile.concat(sbtTypescriptOpts.extraFiles)

        const program:Program = ts.createProgram(filesToCompile, tsConfig.options, compilerHost);
        logger.debug("created program")
        problems.push(...findPreemitProblems(program, options.tsCodesToIgnore))

        const emitOutput = program.emit();

        problems.push(...toProblems(emitOutput.diagnostics, options.tsCodesToIgnore));

        if (logger.isDebug) {
            const declarationFiles = program.getSourceFiles().filter(isDeclarationFile)
            logger.debug("referring to " + declarationFiles.length + " declaration files and " + (program.getSourceFiles().length - declarationFiles.length) + " code files.")
        }

        results = flatten(program.getSourceFiles().filter(isCodeFile).map(toCompilationResult(sourceMaps, tsConfig.options, targetDir)));
    }

    logger.debug("files written", results.map((r)=> r.result.filesWritten))

    const output = <CompilationResult>{
        results: results,
        problems: problems
    };
    return output;

    function determineTargetAssetsDir(options:SbtTypescriptOptions) {
        const assetsRelDir = options.assetsDir.substring(options.tsconfigDir.length, options.assetsDir.length)
        return path.join(target, assetsRelDir)
    }

    function isCodeFile(f:SourceFile) {
        return !(isDeclarationFile(f))
    }

    function isDeclarationFile(f:SourceFile) {
        const fileName = f.fileName
        return ".d.ts" === fileName.substring(fileName.length - 5)
    }

    function flatten<T>(xs:Option<T>[]):T[] {
        var result:T[] = []
        xs.forEach(x => {
            if (x.value) result.push(x.value)
        })
        return result
    }
}

function toCompilationResult(sourceMappings:SourceMappings, compilerOptions:CompilerOptions, targetDir:string):(sf:SourceFile)=> Option<CompilationFileResult> {
    return sourceFile => {
        return sourceMappings.find(sourceFile).map((sm)=> {
            //logger.debug("source file is ",sourceFile.fileName)
            let deps = [sourceFile.fileName].concat(sourceFile.referencedFiles.map(f => f.fileName));

            let outputFile = determineOutFile(sm.toOutputPath(targetDir, ".js"), compilerOptions, targetDir);

            let filesWritten = [outputFile];

            if (compilerOptions.declaration) {
                let outputFileDeclaration = sm.toOutputPath(targetDir, ".d.ts");
                filesWritten.push(outputFileDeclaration);
            }

            if (compilerOptions.sourceMap && !compilerOptions.inlineSourceMap) {
                let outputFileMap = outputFile + ".map";
                fixSourceMapFile(outputFileMap);
                filesWritten.push(outputFileMap);
            }

            const result = <CompilationFileResult>{
                source: sourceFile.fileName,
                result: {
                    filesRead: deps,
                    filesWritten: filesWritten
                }
            };
            return result
        })
    }
}


interface CompilationResult {
    results: CompilationFileResult[]
    problems: Problem[]
}

function compileDone(compileResult:CompilationResult) {
    // datalink escape character https://en.wikipedia.org/wiki/C0_and_C1_control_codes#DLE
    // used to signal result of compilation see https://github.com/sbt/sbt-js-engine/blob/master/src/main/scala/com/typesafe/sbt/jse/SbtJsTask.scala
    console.log("\u0010" + JSON.stringify(compileResult));
}

interface Problem {
    lineNumber: number
    characterOffset: number
    message: string
    source: string
    severity: string
    lineContent: string
}


function findPreemitProblems(program:Program, tsIgnoreList?:number[]):Problem[] {
    let diagnostics = ts.getPreEmitDiagnostics(program)

    if (tsIgnoreList) return diagnostics.filter(ignoreDiagnostic(tsIgnoreList)).map(parseDiagnostic)
    else return diagnostics.map(parseDiagnostic)
}

function toProblems(diagnostics:Diagnostic[], tsIgnoreList?:number[]):Problem[] {
    if (tsIgnoreList) return diagnostics.filter(ignoreDiagnostic(tsIgnoreList)).map(parseDiagnostic)
    else return diagnostics.map(parseDiagnostic)
}

function ignoreDiagnostic(tsIgnoreList:number[]):(d:Diagnostic)=> boolean {
    return (d:Diagnostic) => tsIgnoreList.indexOf(d.code) === -1
}

function parseDiagnostic(d:Diagnostic):Problem {
    let lineCol = {line: 0, character: 0};
    let fileName = "Global";
    let lineText = "";
    if (d.file) {
        lineCol = d.file.getLineAndCharacterOfPosition(d.start);

        let lineStart = d.file.getLineStarts()[lineCol.line];
        let lineEnd = d.file.getLineStarts()[lineCol.line + 1];
        lineText = d.file.text.substring(lineStart, lineEnd);
        fileName = d.file.fileName;
    }

    let problem = <Problem>{
        lineNumber: lineCol.line,
        characterOffset: lineCol.character,
        message: "TS" + d.code + " " + ts.flattenDiagnosticMessageText(d.messageText, ts.sys.newLine),
        source: fileName,
        severity: toSeverity(d.category),
        lineContent: lineText
    };
    return problem;
}

function toSeverity(i:DiagnosticCategory):string {
    if (i === 0) {
        return "warn";
    } else if (i === 1) {
        return "error";
    } else if (i === 2) {
        return "info";
    } else {
        return "error"
    }
}

function determineOutFile(outFile:string, options:CompilerOptions, targetDir:string):string {
    if (options.outFile) {
        logger.debug("single outFile ",options.outFile)
        return options.outFile
    } else {
        return outFile
    }
}

function fixSourceMapFile(file:string) {
    let sourceMap = JSON.parse(fs.readFileSync(file, 'utf-8'));
    sourceMap.sources = sourceMap.sources.map((source:string)=> path.basename(source));
    fs.writeFileSync(file, JSON.stringify(sourceMap), 'utf-8');
}

interface CompilationFileResult {
    source: string
    result: {
        filesRead: string[]
        filesWritten: string[]
    }
}


/** interfacing with sbt */
//from jstranspiler
function parseArgs(args:string[]):Args {

    const SOURCE_FILE_MAPPINGS_ARG = 2;
    const TARGET_ARG = 3;
    const OPTIONS_ARG = 4;

    const cwd = process.cwd();

    let sourceFileMappings:string[][];
    try {
        sourceFileMappings = JSON.parse(args[SOURCE_FILE_MAPPINGS_ARG]);
    } catch (e) {
        sourceFileMappings = [[
            path.join(cwd, args[SOURCE_FILE_MAPPINGS_ARG]),
            args[SOURCE_FILE_MAPPINGS_ARG]
        ]];
    }

    let target = (args.length > TARGET_ARG ? args[TARGET_ARG] : path.join(cwd, "lib"));

    let options:SbtTypescriptOptions;
    if (target.length > 0 && target.charAt(0) === "{") {
        options = JSON.parse(target);
        target = path.join(cwd, "lib");
    } else {
        options = (args.length > OPTIONS_ARG ? JSON.parse(args[OPTIONS_ARG]) : {});
    }

    return <Args>{
        sourceFileMappings: sourceFileMappings,
        target: target,
        options: options
    };

}

interface Args {
    sourceFileMappings:string[][]
    target:string
    options:SbtTypescriptOptions
}

interface SbtTypescriptOptions {
    logLevel:string,
    tsconfig:CompilerOptions,
    tsconfigDir:string,
    assetsDir:string,
    tsCodesToIgnore:number[],
    extraFiles:string[],
    nodeModulesDir:string,
    resolveFromNodeModulesDir:boolean
}

function replaceFileExtension(file:string, ext:string) {
    let oldExt = path.extname(file);
    return file.substring(0, file.length - oldExt.length) + ext;
}


function createCompilerHost(options:CompilerOptions, moduleSearchLocations:string[]):CompilerHost {
    const cHost = ts.createCompilerHost(options)
    cHost.resolveModuleNames = resolveModuleNames
    return cHost

    function resolveModuleNames(moduleNames:string[], containingFile:string):ResolvedModule[] {
        return moduleNames.map(moduleName => {
            // try to use standard resolution
            let result = ts.resolveModuleName(moduleName, containingFile, options, cHost);
            if (result.resolvedModule) {
                //logger.debug("found ",result.resolvedModule)
                return result.resolvedModule;
            }

            //logger.debug("try extra resolution dirs "+moduleName,moduleSearchLocations)
            // check fallback locations, for simplicity assume that module at location should be represented by '.d.ts' file
            for (const location of moduleSearchLocations) {
                const modulePath = path.join(location, moduleName + ".d.ts");
                if (cHost.fileExists(modulePath)) {
                    const resolvedModule = {resolvedFileName: modulePath}
                    if (logger.logLevel === "debug" && logModuleResolution) logger.debug("found in extra location ", resolvedModule)
                    return resolvedModule
                }
            }

            if (logger.logLevel === "warn") logger.warn("could not find "+moduleName)

            return undefined;
        });
    }
}
