"use strict";
var path = require("path");
var Logger = (function () {
    function Logger(logLevel) {
        this.logLevel = logLevel;
        this.isDebug = "debug" === this.logLevel;
    }
    Logger.prototype.debug = function (message, object) {
        if (this.logLevel === "debug" && object)
            console.log(message, object);
        else if (this.logLevel === "debug")
            console.log(message);
    };
    Logger.prototype.info = function (message) {
        if (this.logLevel === "debug" || this.logLevel === "debug")
            console.log(message);
    };
    Logger.prototype.warn = function (message) {
        if (this.logLevel === "debug" || this.logLevel === "info" || this.logLevel === "warn")
            console.log(message);
    };
    Logger.prototype.error = function (message, error) {
        if (this.logLevel === "debug" || this.logLevel === "info" || this.logLevel === "warn" || this.logLevel === "error") {
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
var Some = (function () {
    function Some(value) {
        this.value = value;
    }
    Some.prototype.foreach = function (f) {
        return f(this.value);
    };
    Some.prototype.map = function (f) {
        return new Some(f(this.value));
    };
    return Some;
}());
var None = (function () {
    function None() {
    }
    None.prototype.foreach = function (f) {
        return;
    };
    None.prototype.map = function (f) {
        return new None();
    };
    return None;
}());
var SourceMapping = (function () {
    function SourceMapping(a) {
        this.absolutePath = a[0];
        this.relativePath = a[1];
    }
    SourceMapping.prototype.normalizedAbsolutePath = function () {
        return path.normalize(this.absolutePath);
    };
    SourceMapping.prototype.toOutputPath = function (targetDir, extension) {
        return path.join(targetDir, replaceFileExtension(path.normalize(this.relativePath), extension));
    };
    return SourceMapping;
}());
var SourceMappings = (function () {
    function SourceMappings(sourceFileMappings) {
        this.mappings = sourceFileMappings.map(function (a) { return new SourceMapping(a); });
    }
    SourceMappings.prototype.asAbsolutePaths = function () {
        if (!this.absolutePaths) {
            this.absolutePaths = this.mappings.map(function (sm) { return sm.normalizedAbsolutePath(); });
        }
        return this.absolutePaths;
    };
    SourceMappings.prototype.find = function (sourceFileName) {
        var absPath = path.normalize(sourceFileName);
        var index = this.asAbsolutePaths().indexOf(absPath);
        if (index !== -1) {
            return new Some(this.mappings[index]);
        }
        else {
            return new None();
        }
    };
    return SourceMappings;
}());
function compileDone(compileResult) {
    console.log("\u0010" + JSON.stringify(compileResult));
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
function replaceFileExtension(file, ext) {
    var oldExt = path.extname(file);
    return file.substring(0, file.length - oldExt.length) + ext;
}
var fs = require("fs");
var ts = require("typescript");
var args = parseArgs(process.argv);
var sbtTypescriptOpts = args.options;
var logger = new Logger(sbtTypescriptOpts.logLevel);
var logModuleResolution = false;
var sourceMappings = new SourceMappings(args.sourceFileMappings);
logger.debug("starting compilation of ", sourceMappings.mappings.map(function (sm) { return sm.relativePath; }));
logger.debug("from ", sbtTypescriptOpts.assetsDir);
logger.debug("to ", args.target);
logger.debug("args ", args);
var compileResult = compile(sourceMappings, sbtTypescriptOpts, args.target);
compileDone(compileResult);
function compile(sourceMaps, sbtOptions, target) {
    var problems = [];
    var results = [];
    var _a = toCompilerOptions(sbtOptions), compilerOptions = _a.options, errors = _a.errors;
    if (errors.length > 0) {
        problems.push.apply(problems, toProblems(errors, sbtOptions.tsCodesToIgnore));
    }
    else {
        compilerOptions.outDir = target;
        var resolutionDirs = [];
        if (sbtTypescriptOpts.resolveFromNodeModulesDir)
            resolutionDirs.push(sbtTypescriptOpts.nodeModulesDir);
        logger.debug("using tsc options ", compilerOptions);
        var compilerHost = createCompilerHost(compilerOptions, resolutionDirs);
        var filesToCompile = sourceMaps.asAbsolutePaths();
        if (sbtTypescriptOpts.extraFiles)
            filesToCompile = filesToCompile.concat(sbtTypescriptOpts.extraFiles);
        var program = ts.createProgram(filesToCompile, compilerOptions, compilerHost);
        logger.debug("created program");
        problems.push.apply(problems, findPreemitProblems(program, sbtOptions.tsCodesToIgnore));
        var emitOutput = program.emit();
        problems.push.apply(problems, toProblems(emitOutput.diagnostics, sbtOptions.tsCodesToIgnore));
        if (logger.isDebug) {
            var declarationFiles = program.getSourceFiles().filter(isDeclarationFile);
            logger.debug("referring to " + declarationFiles.length + " declaration files and " + (program.getSourceFiles().length - declarationFiles.length) + " code files.");
        }
        results = flatten(program.getSourceFiles().filter(isCodeFile).map(toCompilationResult(sourceMaps, compilerOptions)));
    }
    logger.debug("files written", results.map(function (r) { return r.result.filesWritten; }));
    var output = {
        results: results,
        problems: problems
    };
    return output;
    function toCompilerOptions(sbtOptions) {
        var unparsedCompilerOptions = sbtOptions.tsconfig["compilerOptions"];
        if (unparsedCompilerOptions.outFile) {
            var outFile = path.join(target, path.basename(unparsedCompilerOptions.outFile));
            logger.debug("single outFile ", outFile);
            unparsedCompilerOptions.outFile = outFile;
        }
        unparsedCompilerOptions.rootDir = sbtOptions.assetsDir;
        return ts.convertCompilerOptionsFromJson(unparsedCompilerOptions, sbtOptions.tsconfigDir, "tsconfig.json");
    }
    function determineTargetAssetsDir(options) {
        var assetsRelDir = options.assetsDir.substring(options.tsconfigDir.length, options.assetsDir.length);
        return path.join(target, assetsRelDir);
    }
    function isCodeFile(f) {
        return !(isDeclarationFile(f));
    }
    function isDeclarationFile(f) {
        var fileName = f.fileName;
        return ".d.ts" === fileName.substring(fileName.length - 5);
    }
    function flatten(xs) {
        var result = [];
        xs.forEach(function (x) {
            if (x.value)
                result.push(x.value);
        });
        return result;
    }
}
function toCompilationResult(sourceMappings, compilerOptions) {
    return function (sourceFile) {
        return sourceMappings.find(sourceFile.fileName).map(function (sm) {
            var deps = [sourceFile.fileName].concat(sourceFile.referencedFiles.map(function (f) { return f.fileName; }));
            var outputFile = determineOutFile(sm.toOutputPath(compilerOptions.outDir, ".js"), compilerOptions);
            var filesWritten = [outputFile];
            if (compilerOptions.declaration) {
                var outputFileDeclaration = sm.toOutputPath(compilerOptions.outDir, ".d.ts");
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
            return result;
            function determineOutFile(outFile, options) {
                if (options.outFile) {
                    logger.debug("single outFile ", options.outFile);
                    return options.outFile;
                }
                else {
                    return outFile;
                }
            }
            function fixSourceMapFile(file) {
                var sourceMap = JSON.parse(fs.readFileSync(file, "utf-8"));
                sourceMap.sources = sourceMap.sources.map(function (source) { return path.basename(source); });
                fs.writeFileSync(file, JSON.stringify(sourceMap), "utf-8");
            }
        });
    };
}
function findPreemitProblems(program, tsIgnoreList) {
    var diagnostics = ts.getPreEmitDiagnostics(program);
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
    var fileName = "tsconfig.json";
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
        message: "TS" + d.code + " " + ts.flattenDiagnosticMessageText(d.messageText, ts.sys.newLine),
        source: fileName,
        severity: toSeverity(d.category),
        lineContent: lineText
    };
    return problem;
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
}
function createCompilerHost(options, moduleSearchLocations) {
    var cHost = ts.createCompilerHost(options);
    cHost.resolveModuleNames = resolveModuleNames;
    return cHost;
    function resolveModuleNames(moduleNames, containingFile) {
        return moduleNames.map(function (moduleName) {
            var result = ts.resolveModuleName(moduleName, containingFile, options, cHost);
            if (result.resolvedModule) {
                return result.resolvedModule;
            }
            for (var _i = 0, moduleSearchLocations_1 = moduleSearchLocations; _i < moduleSearchLocations_1.length; _i++) {
                var location_1 = moduleSearchLocations_1[_i];
                var modulePath = path.join(location_1, moduleName + ".d.ts");
                if (cHost.fileExists(modulePath)) {
                    var resolvedModule = { resolvedFileName: modulePath };
                    if (logger.logLevel === "debug" && logModuleResolution)
                        logger.debug("found in extra location ", resolvedModule);
                    return resolvedModule;
                }
            }
            if (logger.logLevel === "warn")
                logger.warn("could not find " + moduleName);
            return undefined;
        });
    }
}
