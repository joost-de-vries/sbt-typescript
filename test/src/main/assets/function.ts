function decorate(value) {

}

@decorate
class TestClass {
    constructor() {
        console.log("test")
    }
}

export function isEven(i: number) {
    return i % 2 === 0
}