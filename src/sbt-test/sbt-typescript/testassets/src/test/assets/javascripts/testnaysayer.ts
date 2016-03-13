
class TestGreeter {
    constructor(public greeting: string) { }
    greet() {
        return "<h1>" + this.greeting + "</h1>";
    }
};

var greeter = new TestGreeter("Hello, world!");

var response = greeter.greet();