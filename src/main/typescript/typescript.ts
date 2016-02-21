/* global process, require */
// inspired by https://github.com/ArpNetworking/sbt-typescript/blob/master/src/main/resources/typescriptc.js
import {Program,Diagnostic,SourceFile,CompilerOptions,DiagnosticMessageChain,DiagnosticCategory,CompilerHost,ResolvedModule,ScriptTarget} from 'typescript'


class Logger {
    constructor(private logLevel:string) {
    }

    debug(message:string, object?:any) {
        if (this.logLevel === 'debug') console.log(message, object);
    }

    info(message:string) {
        if (this.logLevel === 'debug' || this.logLevel === 'info') console.log(message);
    }

    warn(message:string) {
        if (this.logLevel === 'debug' || this.logLevel === 'info' || this.logLevel === 'warn') console.log(message);
    }

    error(message:string, error?) {
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

    const fs = require('fs');
    const typescript = require("typescript");
    const path = require("path");
    const mkdirp = require("mkdirp")

    const args:Args = parseArgs(process.argv);

    const sbtTypescriptOpts:SbtTypescriptOptions = args.options

    const logger = new Logger(sbtTypescriptOpts.logLevel);
    logger.debug("starting compile of ",args.sourceFileMappings.map((a)=> a[1]));
    logger.debug("from ", sbtTypescriptOpts.assetsDir);

    const compileResult = compile(args.sourceFileMappings, sbtTypescriptOpts, args.target)
    compileDone(compileResult)

    function compile(sourceMaps:string[][], options:SbtTypescriptOptions, target:string):CompilationResult {
        const problems:Problem[] = []

        let [inputFiles,outputFiles]=toInputOutputFiles(sourceMaps)

        const confResult = typescript.parseConfigFileTextToJson(options.tsconfigDir, JSON.stringify(options.tsconfig));
        let results:CompilationFileResult[] = []
        if (confResult.error) problems.push(parseDiagnostic(confResult.error))
        else if (confResult.config) {
            logger.debug("options ", confResult.config.compilerOptions);
            const compilerOptions:CompilerOptions = confResult.config.compilerOptions
            compilerOptions.rootDir = sbtTypescriptOpts.assetsDir
            compilerOptions.outDir = target;

            let resolutionDirs = []
            if(sbtTypescriptOpts.resolveFromNodeModulesDir) resolutionDirs.push(sbtTypescriptOpts.nodeModulesDir)
            const compilerHost = createCompilerHost(compilerOptions,resolutionDirs);

            let filesToCompile = inputFiles
            if (sbtTypescriptOpts.extraFiles) filesToCompile = inputFiles.concat(sbtTypescriptOpts.extraFiles)

            const program:Program = typescript.createProgram(filesToCompile, compilerOptions, compilerHost);

            problems.push(...findGlobalProblems(program, options.tsCodesToIgnore))

            const emitOutput = program.emit();
            problems.push(...toProblems(emitOutput.diagnostics, options.tsCodesToIgnore));

            const sourceFiles:SourceFile[] = program.getSourceFiles();
            logger.debug("program sourcefiles " ,sourceFiles.length)//+ JSON.stringify(sourceFiles.map(sf => sf.fileName)));

            results = flatten(sourceFiles.map(toCompilationResult(inputFiles, outputFiles, compilerOptions, logger)));

        }

        function flatten<T>(xs:Option<T>[]):T[] {
            var result = []
            xs.forEach(x => {
                if (x.value) result.push(x.value)
            })
            return result
        }


        const output = <CompilationResult>{
            results: results,
            problems: problems
        };
        return output;
    }

    interface CompilationResult {
        results: CompilationFileResult[]
        problems: Problem[]
    }

    function calculateRootDir(sourceMaps):string {
        if (sourceMaps.length) {
            const inputFile = path.normalize(sourceMaps[0][0]);
            const outputFile = path.normalize(sourceMaps[0][1]);
            const rootDir = inputFile.substring(0, inputFile.length - outputFile.length);
            console.log("rootdir is", rootDir)
            return rootDir
        } else {
            return ""
        }
    }

    function compileDone(compileResult:CompilationResult) {
        // datalink escape character https://en.wikipedia.org/wiki/C0_and_C1_control_codes#DLE
        // used to signal result of compilation see https://github.com/sbt/sbt-js-engine/blob/master/src/main/scala/com/typesafe/sbt/jse/SbtJsTask.scala
        console.log("\u0010" + JSON.stringify(compileResult));
    }


    function toInputOutputFiles(sourceMaps):[string[],string[]] {
        const inputFiles = []
        const outputFiles = []
        sourceMaps.forEach((sourceMap) => {
            const absolutFilePath = sourceMap[0]
            const relativeFilePath = sourceMap[1]

            inputFiles.push(path.normalize(absolutFilePath));

            outputFiles.push(path.join(
                args.target,
                replaceFileExtension(path.normalize(relativeFilePath), ".js")
            ));
        });
        return [inputFiles, outputFiles]
    }

    interface Problem {
        lineNumber: number
        characterOffset: number
        message: string
        source: string
        severity: string
        lineContent: string
    }


    function findGlobalProblems(program:Program, tsIgnoreList?:number[]):Problem[] {
        let diagnostics = program.getSyntacticDiagnostics()
            .concat(program.getGlobalDiagnostics())
            .concat(program.getSemanticDiagnostics())

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
            message: d.code + " " + typescript.flattenDiagnosticMessageText(d.messageText, typescript.sys.newLine),
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

    /* compilation results */
    export function toCompilationResult(inputFiles, outputFiles, compilerOptions:CompilerOptions, logger:Logger):(sf:SourceFile)=> Option<CompilationFileResult> {
        return sourceFile => {
            let index = inputFiles.indexOf(path.normalize(sourceFile.fileName));
            if (index === -1) {
                //logger.debug("did not find source file " + sourceFile.fileName + " in list compile list, assuming library or dependency and skipping output");
                return <Option<CompilationFileResult>>{
                    //none
                };
            }

            let deps = [sourceFile.fileName].concat(sourceFile.referencedFiles.map(f => f.fileName));

            let outputFile = determineOutFile(outputFiles[index], compilerOptions, logger);

            let filesWritten = [outputFile];

            if (compilerOptions.declaration) {
                let outputFileDeclaration = replaceFileExtension(outputFile, ".d.ts");
                filesWritten.push(outputFileDeclaration);
            }

            if (compilerOptions.sourceMap && !compilerOptions.inlineSourceMap) {
                let outputFileMap = outputFile + ".map";
                fixSourceMapFile(outputFileMap);
                filesWritten.push(outputFileMap);
            }

            console.log("files written ",filesWritten)
            const result = <CompilationFileResult>{
                source: sourceFile.fileName,
                result: {
                    filesRead: deps,
                    filesWritten: filesWritten
                }
            };
            return <Option<CompilationFileResult>>{
                value: result
            };
        }
    }

    function determineOutFile(outFile, options:CompilerOptions, logger:Logger):string {
        if (options.outFile) {
            logger.debug("single outFile")
            return options.outFile
        } else {
            return outFile
        }
    }

    function fixSourceMapFile(file) {
        let sourceMap = JSON.parse(fs.readFileSync(file, 'utf-8'));
        sourceMap.sources = sourceMap.sources.map((source)=> path.basename(source));
        fs.writeFileSync(file, JSON.stringify(sourceMap), 'utf-8');
    }

    export interface CompilationFileResult {
        source: string
        result: {
            filesRead: string[]
            filesWritten: string[]
        }
    }

    export interface Option<T> {
        value?: T
    }

/** interfacing with sbt */
//from jstranspiler
export function parseArgs(args):Args {

    const SOURCE_FILE_MAPPINGS_ARG = 2;
    const TARGET_ARG = 3;
    const OPTIONS_ARG = 4;

    const cwd = process.cwd();

    let sourceFileMappings;
    try {
        sourceFileMappings = JSON.parse(args[SOURCE_FILE_MAPPINGS_ARG]);
    } catch (e) {
        sourceFileMappings = [[
            path.join(cwd, args[SOURCE_FILE_MAPPINGS_ARG]),
            args[SOURCE_FILE_MAPPINGS_ARG]
        ]];
    }

    let target = (args.length > TARGET_ARG ? args[TARGET_ARG] : path.join(cwd, "lib"));

    let options;
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

export interface Args {
    sourceFileMappings:string[][]
    target:string
    options:SbtTypescriptOptions
}

export interface SbtTypescriptOptions {
    logLevel:string,
    tsconfig:any,
    tsconfigDir:string,
    assetsDir:string,
    tsCodesToIgnore:number[],
    extraFiles:string[],
    nodeModulesDir:string,
    resolveFromNodeModulesDir:boolean
}

 function replaceFileExtension(file:string, ext:string) {
    const path = require("path");
    let oldExt = path.extname(file);
    return file.substring(0, file.length - oldExt.length) + ext;
}


function createCompilerHost(options: CompilerOptions, moduleSearchLocations: string[]): CompilerHost {
    const cHost=typescript.createCompilerHost(options)
    cHost.resolveModuleNames=resolveModuleNames
    return cHost

    function resolveModuleNames(moduleNames: string[], containingFile: string): ResolvedModule[] {
        return moduleNames.map(moduleName => {
            // try to use standard resolution
            let result = typescript.resolveModuleName(moduleName, containingFile, options, cHost);
            if (result.resolvedModule) {
                //logger.debug("found ",result.resolvedModule)
                return result.resolvedModule;
            }else{
                //logger.error("not found "+moduleName,containingFile)
            }

            // check fallback locations, for simplicity assume that module at location should be represented by '.d.ts' file
            for (const location of moduleSearchLocations) {
                const modulePath = path.join(location, moduleName + ".d.ts");
                if (cHost.fileExists(modulePath)) {
                    const resolvedModule = { resolvedFileName: modulePath }
                    //logger.debug("found in extra location ",resolvedModule)
                    return resolvedModule
                }else{
                    //logger.debug("gave up")
                }
            }

            return undefined;
        });
    }
}