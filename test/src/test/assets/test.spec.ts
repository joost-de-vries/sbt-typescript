///<reference path="../../../target/web/node-modules/main/webjars/@types/jasmine/index.d.ts"/>
import { isEven } from "./function"


describe("some component", () => {
    it("does something", () => {
        expect(isEven(3)).toBe(false)
        // This is a test.
        console.log("running js test ")
    })
})