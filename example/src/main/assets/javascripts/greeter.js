System.register([], function(exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    var Greeter;
    return {
        setters:[],
        execute: function() {
            Greeter = (function () {
                function Greeter(greeting) {
                    this.greeting = greeting;
                }
                Greeter.prototype.greet = function () {
                    return "<h1>" + this.greeting + "</h1>";
                };
                return Greeter;
            }());
            exports_1("Greeter", Greeter);
            ;
        }
    }
});
//# sourceMappingURL=greeter.js.map