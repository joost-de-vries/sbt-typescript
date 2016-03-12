var path = require("path");
var Logger = (function () {
    function Logger(logLevel) {
        this.logLevel = logLevel;
        this.isDebug = 'debug' === this.logLevel;
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
        if (index != -1) {
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
