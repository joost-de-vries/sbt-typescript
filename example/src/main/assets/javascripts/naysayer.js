System.register([], function(exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    var Naysayer;
    return {
        setters:[],
        execute: function() {
            Naysayer = (function () {
                function Naysayer(greeting) {
                    this.greeting = greeting;
                }
                Naysayer.prototype.greet = function () {
                    return "<h1>Not " + this.greeting + "</h1>";
                };
                return Naysayer;
            }());
            exports_1("Naysayer", Naysayer);
            ;
        }
    }
});
//# sourceMappingURL=naysayer.js.map