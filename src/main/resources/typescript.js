"use strict";
var Logger = (function () {
    function Logger(logLevel) {
        this.logLevel = logLevel;
    }
    Logger.prototype.debug = function (message, object) {
        if (this.logLevel === 'debug' && object)
            console.log(message, object);
        else if (this.logLevel === 'debug')
            console.log(message);
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
var mkdirp = require("mkdirp");
var args = parseArgs(process.argv);
var sbtTypescriptOpts = args.options;
var logger = new Logger(sbtTypescriptOpts.logLevel);
logger.debug("starting compile of ", args.sourceFileMappings.map(function (a) { return a[1]; }));
logger.debug("from ", sbtTypescriptOpts.assetsDir);
logger.debug("args ", args);
var compileResult = compile(args.sourceFileMappings, sbtTypescriptOpts, args.target);
compileDone(compileResult);
function compile(sourceMaps, options, target) {
    var problems = [];
    var _a = toInputOutputFiles(sourceMaps), inputFiles = _a[0], outputFiles = _a[1];
    var unparsedCompilerOptions = options.tsconfig["compilerOptions"];
    logger.debug("compilerOptions ", unparsedCompilerOptions);
    var tsConfig = typescript.convertCompilerOptionsFromJson(unparsedCompilerOptions, options.tsconfigDir, "tsconfig.json");
    var results = [];
    if (tsConfig.errors.length > 0) {
        logger.debug("errors during parsing of compilerOptions", tsConfig.errors);
        problems.push.apply(problems, toProblems(tsConfig.errors, options.tsCodesToIgnore));
    }
    else {
        tsConfig.options.rootDir = sbtTypescriptOpts.assetsDir;
        tsConfig.options.outDir = target;
        var resolutionDirs = [];
        if (sbtTypescriptOpts.resolveFromNodeModulesDir)
            resolutionDirs.push(sbtTypescriptOpts.nodeModulesDir);
        var compilerHost = createCompilerHost(tsConfig.options, resolutionDirs);
        var filesToCompile = inputFiles;
        if (sbtTypescriptOpts.extraFiles)
            filesToCompile = inputFiles.concat(sbtTypescriptOpts.extraFiles);
        var program = typescript.createProgram(filesToCompile, tsConfig.options, compilerHost);
        logger.debug("created program");
        problems.push.apply(problems, findGlobalProblems(program, options.tsCodesToIgnore));
        var emitOutput = program.emit();
        problems.push.apply(problems, toProblems(emitOutput.diagnostics, options.tsCodesToIgnore));
        var sourceFiles = program.getSourceFiles();
        logger.debug("program sourcefiles ", sourceFiles.length);
        results = flatten(sourceFiles.map(toCompilationResult(inputFiles, outputFiles, tsConfig.options, logger)));
    }
    function flatten(xs) {
        var result = [];
        xs.forEach(function (x) {
            if (x.value)
                result.push(x.value);
        });
        return result;
    }
    var output = {
        results: results,
        problems: problems
    };
    return output;
}
function compileDone(compileResult) {
    console.log("\u0010" + JSON.stringify(compileResult));
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
function toCompilationResult(inputFiles, outputFiles, compilerOptions, logger) {
    return function (sourceFile) {
        var index = inputFiles.indexOf(path.normalize(sourceFile.fileName));
        if (index === -1) {
            return {};
        }
        var deps = [sourceFile.fileName].concat(sourceFile.referencedFiles.map(function (f) { return f.fileName; }));
        var outputFile = determineOutFile(outputFiles[index], compilerOptions, logger);
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
        logger.debug("files written ", filesWritten);
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
exports.toCompilationResult = toCompilationResult;
function determineOutFile(outFile, options, logger) {
    if (options.outFile) {
        logger.debug("single outFile");
        return options.outFile;
    }
    else {
        return outFile;
    }
}
function fixSourceMapFile(file) {
    var sourceMap = JSON.parse(fs.readFileSync(file, 'utf-8'));
    sourceMap.sources = sourceMap.sources.map(function (source) { return path.basename(source); });
    fs.writeFileSync(file, JSON.stringify(sourceMap), 'utf-8');
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
exports.parseArgs = parseArgs;
function replaceFileExtension(file, ext) {
    var path = require("path");
    var oldExt = path.extname(file);
    return file.substring(0, file.length - oldExt.length) + ext;
}
function createCompilerHost(options, moduleSearchLocations) {
    var cHost = typescript.createCompilerHost(options);
    cHost.resolveModuleNames = resolveModuleNames;
    return cHost;
    function resolveModuleNames(moduleNames, containingFile) {
        return moduleNames.map(function (moduleName) {
            var result = typescript.resolveModuleName(moduleName, containingFile, options, cHost);
            if (result.resolvedModule) {
                return result.resolvedModule;
            }
            else {
            }
            for (var _i = 0, moduleSearchLocations_1 = moduleSearchLocations; _i < moduleSearchLocations_1.length; _i++) {
                var location_1 = moduleSearchLocations_1[_i];
                var modulePath = path.join(location_1, moduleName + ".d.ts");
                if (cHost.fileExists(modulePath)) {
                    var resolvedModule = { resolvedFileName: modulePath };
                    if (logger.logLevel === "debug")
                        logger.debug("found in extra location ", resolvedModule);
                    return resolvedModule;
                }
                else {
                    if (logger.logLevel === "warn")
                        logger.warn("gave up");
                }
            }
            return undefined;
        });
    }
}
