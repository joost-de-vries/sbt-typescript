
export class Naysayer {
    constructor(public greeting: string) { }
    greet() {
        return "<h1>Not " + this.greeting + "</h1>";
    }
};

