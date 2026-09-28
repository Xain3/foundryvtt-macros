# Tests

Unit tests use Node.js's built-in `node:test` runner and `node:assert/strict`. They run outside Foundry, so macros that depend on Foundry globals should receive focused test doubles.

## Run tests

From the repository root, run:

```bash
npm test
```

## Conventions

- Keep tests in this folder and name them `*.test.js`.
- Test observable behavior and meaningful outcomes, not just whether a macro loads.
- Stub only the Foundry globals a test needs, and keep those stubs minimal.
- Tests verify behavior against their test doubles; they do not certify behavior in a live Foundry runtime.

See `hello-world.test.js` for an example that checks a macro's console output.
