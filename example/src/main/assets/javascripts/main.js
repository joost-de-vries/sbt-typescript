System.register(["./greeter", "./naysayer"], function(exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    var greeter_1, naysayer_1;
    var greeter, response, naysayer;
    return {
        setters:[
            function (greeter_1_1) {
                greeter_1 = greeter_1_1;
            },
            function (naysayer_1_1) {
                naysayer_1 = naysayer_1_1;
            }],
        execute: function() {
            greeter = new greeter_1.Greeter("Hello, world!");
            response = greeter.greet();
            naysayer = new naysayer_1.Naysayer("Hello, world!");
            response = naysayer.greet();
        }
    }
});
//# sourceMappingURL=main.js.map