
class TestNaysayer {
    constructor(public greeting: string) { }
    greet() {
        return "<h1>Not " + this.greeting + "</h1>";
    }
};

var greeter = new TestNaysayer("Hello, world!");

var response = greeter.greet();