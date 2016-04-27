/* global process, require */
/// <reference path="./internal.ts" />
/// <reference path="../../../typings/main.d.ts" />
import {
    Program,
    Diagnostic,
    SourceFile,
    CompilerOptions,
    DiagnosticCategory,
} from "typescript"

const fs = require("fs")
const ts = require("typescript")

const args:Args = parseArgs(process.argv)
const sbtTypescriptOpts:SbtTypescriptOptions = args.options

const logger = new Logger(sbtTypescriptOpts.logLevel)

const sourceMappings = new SourceMappings(args.sourceFileMappings)

logger.debug("starting compilation of ", sourceMappings.mappings.map((sm)=> sm.relativePath))
logger.debug("from ", sbtTypescriptOpts.assetsDir)
logger.debug("to ", args.target)
logger.debug("args ", args)

const compileResult = compile(sourceMappings, sbtTypescriptOpts, args.target)

compileDone(compileResult)

function compile(sourceMaps:SourceMappings, sbtOptions:SbtTypescriptOptions, target:string):CompilationResult {
    const problems:Problem[] = []
    let results:CompilationFileResult[] = []

    const {options: compilerOptions, errors} = toCompilerOptions(sbtOptions)

    if (errors.length > 0) {
        problems.push(...toProblems(errors, sbtOptions.tsCodesToIgnore))
    }
    else {
        compilerOptions.outDir = target

        if (sbtTypescriptOpts.resolveFromNodeModulesDir) {
            // see https://github.com/Microsoft/TypeScript-Handbook/blob/release-2.0/pages/Module%20Resolution.md#path-mapping
            compilerOptions.baseUrl="."
            const paths = {
                "*": ["*",sbtTypescriptOpts.nodeModulesDir +"/*"]
            }
            compilerOptions.paths = paths
            // "baseUrl": ".",
            //     "paths": {
            //     "*": [
            //         "*",
            //         "generated/*"
            //     ]
            // }
        }
        logger.debug("using tsc options ", compilerOptions)
        const compilerHost = ts.createCompilerHost(compilerOptions)

        let filesToCompile = sourceMaps.asAbsolutePaths()
        if (sbtTypescriptOpts.extraFiles) filesToCompile = filesToCompile.concat(sbtTypescriptOpts.extraFiles)

        const program:Program = ts.createProgram(filesToCompile, compilerOptions, compilerHost)
        logger.debug("created program")
        problems.push(...findPreemitProblems(program, sbtOptions.tsCodesToIgnore))

        const emitOutput = program.emit()

        problems.push(...toProblems(emitOutput.diagnostics, sbtOptions.tsCodesToIgnore))

        if (logger.isDebug) {
            const declarationFiles = program.getSourceFiles().filter(isDeclarationFile)
            logger.debug("referring to " + declarationFiles.length + " declaration files and " + (program.getSourceFiles().length - declarationFiles.length) + " code files.")
        }

        results = flatten(program.getSourceFiles().filter(isCodeFile).map(toCompilationResult(sourceMaps, compilerOptions)))
    }

    logger.debug("files written", results.map((r)=> r.result.filesWritten))

    const output = <CompilationResult>{
        results: results,
        problems: problems
    }
    return output

    function toCompilerOptions(sbtOptions:SbtTypescriptOptions):{ options:CompilerOptions, errors:Diagnostic[] } {
        const unparsedCompilerOptions:any = sbtOptions.tsconfig["compilerOptions"]
        // logger.debug("compilerOptions ", unparsedCompilerOptions)
        if (unparsedCompilerOptions.outFile) {
            const outFile = path.join(target, path.basename(unparsedCompilerOptions.outFile))
            logger.debug("single outFile ", outFile)
            unparsedCompilerOptions.outFile = outFile
        }
        unparsedCompilerOptions.rootDir = sbtOptions.assetsDir
        return ts.convertCompilerOptionsFromJson(unparsedCompilerOptions, sbtOptions.tsconfigDir, "tsconfig.json")

    }

    function isCodeFile(f:SourceFile) {
        return !(isDeclarationFile(f))
    }

    function isDeclarationFile(f:SourceFile) {
        const fileName = f.fileName
        return ".d.ts" === fileName.substring(fileName.length - 5)
    }

    function flatten<T>(xs:Option<T>[]):T[] {
        let result:T[] = []
        xs.forEach(x => {
            if (x.value) result.push(x.value)
        })
        return result
    }
}

function toCompilationResult(sourceMappings:SourceMappings, compilerOptions:CompilerOptions):(sf:SourceFile)=> Option<CompilationFileResult> {
    return sourceFile => {
        return sourceMappings.find(sourceFile.fileName).map((sm)=> {
            // logger.debug("source file is ",sourceFile.fileName)
            let deps = [sourceFile.fileName].concat(sourceFile.referencedFiles.map(f => f.fileName))

            let outputFile = determineOutFile(sm.toOutputPath(compilerOptions.outDir, ".js"), compilerOptions)

            let filesWritten = [outputFile]

            if (compilerOptions.declaration) {
                let outputFileDeclaration = sm.toOutputPath(compilerOptions.outDir, ".d.ts")
                filesWritten.push(outputFileDeclaration)
            }

            if (compilerOptions.sourceMap && !compilerOptions.inlineSourceMap) {
                let outputFileMap = outputFile + ".map"
                fixSourceMapFile(outputFileMap)
                filesWritten.push(outputFileMap)
            }

            const result = <CompilationFileResult>{
                source: sourceFile.fileName,
                result: {
                    filesRead: deps,
                    filesWritten: filesWritten
                }
            }
            return result

            function determineOutFile(outFile:string, options:CompilerOptions):string {
                if (options.outFile) {
                    logger.debug("single outFile ", options.outFile)
                    return options.outFile
                } else {
                    return outFile
                }
            }

            function fixSourceMapFile(file:string) {
                let sourceMap = JSON.parse(fs.readFileSync(file, "utf-8"))
                sourceMap.sources = sourceMap.sources.map((source:string)=> path.basename(source))
                fs.writeFileSync(file, JSON.stringify(sourceMap), "utf-8")
            }
        })
    }
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
    let lineCol = {line: 0, character: 0}
    let fileName = "tsconfig.json"
    let lineText = ""
    if (d.file) {
        lineCol = d.file.getLineAndCharacterOfPosition(d.start)

        let lineStart = d.file.getLineStarts()[lineCol.line]
        let lineEnd = d.file.getLineStarts()[lineCol.line + 1]
        lineText = d.file.text.substring(lineStart, lineEnd)
        fileName = d.file.fileName
    }

    let problem = <Problem>{
        lineNumber: lineCol.line,
        characterOffset: lineCol.character,
        message: "TS" + d.code + " " + ts.flattenDiagnosticMessageText(d.messageText, ts.sys.newLine),
        source: fileName,
        severity: toSeverity(d.category),
        lineContent: lineText
    }
    return problem

    function toSeverity(i:DiagnosticCategory):string {
        if (i === 0) {
            return "warn"
        } else if (i === 1) {
            return "error"
        } else if (i === 2) {
            return "info"
        } else {
            return "error"
        }
    }
}
