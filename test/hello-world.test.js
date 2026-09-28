import assert from "node:assert/strict";
import { test } from "node:test";
import { helloWorld } from "../macros/utilities/hello-world.js";

test("helloWorld logs a greeting", (context) => {
    const log = context.mock.method(console, "log", () => {});

    helloWorld();

    assert.equal(log.mock.callCount(), 1);
    assert.deepEqual(log.mock.calls[0].arguments, ["Hello, World!"]);
});
