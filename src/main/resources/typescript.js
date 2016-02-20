"use strict";
var st;
(function (st) {
    "use strict";
    var Logger = (function () {
        function Logger(logLevel) {
            this.logLevel = logLevel;
        }
        Logger.prototype.debug = function (message, object) {
            if (this.logLevel === 'debug')
                console.log(message, object);
        };
        Logger.prototype.info = function (message) {
            if (this.logLevel === 'debug' || this.logLevel === 'info')
                console.log(message);
        };
        Logger.prototype.warn = function (message) {
            if (this.logLevel === 'debug' || this.logLevel === 'info' || this.logLevel === 'warn')
                console.log(message);
        };
        Logger.prototype.error = function (message, error) {
            if (this.logLevel === 'debug' || this.logLevel === 'info' || this.logLevel === 'warn' || this.logLevel === 'error') {
                if (error !== undefined) {
                    var errorMessage = error.message;
                    if (error.fileName !== undefined) {
                        errorMessage = errorMessage + " in " + error.fileName;
                    }
                    if (error.lineNumber !== undefined) {
                        errorMessage = errorMessage + " at line " + error.lineNumber;
                    }
                    console.log(message + " " + errorMessage);
                }
                else {
                    console.log(message);
                }
            }
        };
        return Logger;
    }());
    var fs = require('fs');
    var typescript = require("typescript");
    var path = require("path");
    var args = parseArgs(process.argv);
    var sbtTypescriptOpts = args.options;
    var logger = new Logger(sbtTypescriptOpts.logLevel);
    logger.debug("starting compile");
    logger.debug("args: ", args);
    logger.debug("target: " + args.target);
    var compileResult = compile(args.sourceFileMappings, sbtTypescriptOpts, args.target);
    compileDone(compileResult);
    function compile(sourceMaps, options, target) {
        var problems = [];
        var _a = toInputOutputFiles(sourceMaps), inputFiles = _a[0], outputFiles = _a[1];
        logger.debug("starting compilation of " + sourceMaps);
        logger.debug("compiler options: ", options.tsconfig);
        var confResult = typescript.parseConfigFileTextToJson(options.tsconfigDir, JSON.stringify(options.tsconfig));
        var results = [];
        if (confResult.error)
            problems.push(parseDiagnostic(confResult.error));
        else if (confResult.config) {
            logger.debug("parsed compiler options: ", confResult.config);
            var compilerOptions = confResult.config.compilerOptions;
            compilerOptions.rootDir = sbtTypescriptOpts.assetsDir;
            compilerOptions.outDir = target;
            var compilerHost = typescript.createCompilerHost(compilerOptions);
            var filesToCompile = inputFiles;
            if (sbtTypescriptOpts.extraFiles)
                filesToCompile = inputFiles.concat(sbtTypescriptOpts.extraFiles);
            var program = typescript.createProgram(filesToCompile, compilerOptions, compilerHost);
            problems.push.apply(problems, findGlobalProblems(program, options.tsCodesToIgnore));
            var emitOutput = program.emit();
            problems.push.apply(problems, toProblems(emitOutput.diagnostics, options.tsCodesToIgnore));
            var sourceFiles = program.getSourceFiles();
            logger.debug("got some source files " + JSON.stringify(sourceFiles.map(function (sf) { return sf.fileName; })));
            results = flatten(sourceFiles.map(toCompilationResult(inputFiles, outputFiles, compilerOptions)));
        }
        var output = {
            results: results,
            problems: problems
        };
        return output;
    }
    function calculateRootDir(sourceMaps) {
        if (sourceMaps.length) {
            var inputFile = path.normalize(sourceMaps[0][0]);
            var outputFile = path.normalize(sourceMaps[0][1]);
            var rootDir = inputFile.substring(0, inputFile.length - outputFile.length);
            console.log("rootdir is", rootDir);
            return rootDir;
        }
        else {
            return "";
        }
    }
    function compileDone(compileResult) {
        console.log(JSON.stringify(compileResult));
        console.log("\u0010" + JSON.stringify(compileResult));
    }
    function determineOutFile(outFile, options) {
        if (options.outFile) {
            logger.debug("single outFile");
            return options.outFile;
        }
        else {
            return outFile;
        }
    }
    function toCompilationResult(inputFiles, outputFiles, compilerOptions) {
        return function (sourceFile) {
            var index = inputFiles.indexOf(path.normalize(sourceFile.fileName));
            if (index === -1) {
                logger.debug("did not find source file " + sourceFile.fileName + " in list compile list, assuming library or dependency and skipping output");
                return {};
            }
            var deps = [sourceFile.fileName].concat(sourceFile.referencedFiles.map(function (f) { return f.fileName; }));
            console.log("referenced files", sourceFile.referencedFiles);
            var outputFile = determineOutFile(outputFiles[index], compilerOptions);
            var filesWritten = [outputFile];
            if (compilerOptions.declaration) {
                var outputFileDeclaration = replaceFileExtension(outputFile, ".d.ts");
                filesWritten.push(outputFileDeclaration);
            }
            if (compilerOptions.sourceMap && !compilerOptions.inlineSourceMap) {
                var outputFileMap = outputFile + ".map";
                fixSourceMapFile(outputFileMap);
                filesWritten.push(outputFileMap);
            }
            var result = {
                source: sourceFile.fileName,
                result: {
                    filesRead: deps,
                    filesWritten: filesWritten
                }
            };
            return {
                value: result
            };
        };
    }
    function flatten(xs) {
        var result = [];
        xs.forEach(function (x) {
            if (x.value)
                result.push(x.value);
        });
        return result;
    }
    function toInputOutputFiles(sourceMaps) {
        var inputFiles = [];
        var outputFiles = [];
        sourceMaps.forEach(function (sourceMap) {
            var absolutFilePath = sourceMap[0];
            var relativeFilePath = sourceMap[1];
            inputFiles.push(path.normalize(absolutFilePath));
            outputFiles.push(path.join(args.target, replaceFileExtension(path.normalize(relativeFilePath), ".js")));
        });
        return [inputFiles, outputFiles];
    }
    function replaceFileExtension(file, ext) {
        var oldExt = path.extname(file);
        return file.substring(0, file.length - oldExt.length) + ext;
    }
    function fixSourceMapFile(file) {
        var sourceMap = JSON.parse(fs.readFileSync(file, 'utf-8'));
        sourceMap.sources = sourceMap.sources.map(function (source) { return path.basename(source); });
        fs.writeFileSync(file, JSON.stringify(sourceMap), 'utf-8');
    }
    function findGlobalProblems(program, tsIgnoreList) {
        var diagnostics = program.getSyntacticDiagnostics()
            .concat(program.getGlobalDiagnostics())
            .concat(program.getSemanticDiagnostics());
        if (tsIgnoreList)
            return diagnostics.filter(ignoreDiagnostic(tsIgnoreList)).map(parseDiagnostic);
        else
            return diagnostics.map(parseDiagnostic);
    }
    function toProblems(diagnostics, tsIgnoreList) {
        if (tsIgnoreList)
            return diagnostics.filter(ignoreDiagnostic(tsIgnoreList)).map(parseDiagnostic);
        else
            return diagnostics.map(parseDiagnostic);
    }
    function ignoreDiagnostic(tsIgnoreList) {
        return function (d) { return tsIgnoreList.indexOf(d.code) === -1; };
    }
    function parseDiagnostic(d) {
        var lineCol = { line: 0, character: 0 };
        var fileName = "Global";
        var lineText = "";
        if (d.file) {
            lineCol = d.file.getLineAndCharacterOfPosition(d.start);
            var lineStart = d.file.getLineStarts()[lineCol.line];
            var lineEnd = d.file.getLineStarts()[lineCol.line + 1];
            lineText = d.file.text.substring(lineStart, lineEnd);
            fileName = d.file.fileName;
        }
        var problem = {
            lineNumber: lineCol.line,
            characterOffset: lineCol.character,
            message: d.code + " " + typescript.flattenDiagnosticMessageText(d.messageText, typescript.sys.newLine),
            source: fileName,
            severity: toSeverity(d.category),
            lineContent: lineText
        };
        return problem;
    }
    function toSeverity(i) {
        if (i === 0) {
            return "warn";
        }
        else if (i === 1) {
            return "error";
        }
        else if (i === 2) {
            return "info";
        }
        else {
            return "error";
        }
    }
    function parseArgs(args) {
        var SOURCE_FILE_MAPPINGS_ARG = 2;
        var TARGET_ARG = 3;
        var OPTIONS_ARG = 4;
        var cwd = process.cwd();
        var sourceFileMappings;
        try {
            sourceFileMappings = JSON.parse(args[SOURCE_FILE_MAPPINGS_ARG]);
        }
        catch (e) {
            sourceFileMappings = [[
                    path.join(cwd, args[SOURCE_FILE_MAPPINGS_ARG]),
                    args[SOURCE_FILE_MAPPINGS_ARG]
                ]];
        }
        var target = (args.length > TARGET_ARG ? args[TARGET_ARG] : path.join(cwd, "lib"));
        var options;
        if (target.length > 0 && target.charAt(0) === "{") {
            options = JSON.parse(target);
            target = path.join(cwd, "lib");
        }
        else {
            options = (args.length > OPTIONS_ARG ? JSON.parse(args[OPTIONS_ARG]) : {});
        }
        return {
            sourceFileMappings: sourceFileMappings,
            target: target,
            options: options
        };
    }
})(st || (st = {}));
