# FoundryVTT Macros Project Instructions

## Project purpose

This repository contains Foundry VTT macro scripts and supporting compatibility shims. The codebase is intentionally small and focused on plain JavaScript macro snippets rather than frameworks or large application structure.

## Core conventions

- Keep macros as small, self-contained JavaScript snippets.
- Start every macro with a header stating its purpose, a useful description of its main behavior and important requirements, its author or authors, license (`MIT`), and version. Make the description detailed enough to explain key modes or effects without duplicating full documentation. Track each macro's version independently; do not derive it from the package version or another macro's version.
- Prefer clear, readable code over abstraction or unnecessary tooling.
- Use the Foundry VTT API as the source of truth: reference the official API docs when making runtime assumptions.
- Treat the shims as compatibility aids for local development and linting, not as a replacement for the actual Foundry runtime.
- When a macro depends on Foundry globals such as `game`, `canvas`, `ui`, or document classes, document that dependency clearly in the file or nearby README.

## File layout guidance

- Place macro scripts under `macros/`.
- Use subfolders such as `macros/utilities/` for reusable helper logic.
- Keep compatibility helpers under `shims/` and make them intentionally minimal.
- Prefer simple repository-level documentation over complex project scaffolding.

## Implementation guidance

- Do not introduce framework dependencies unless the user explicitly asks for them.
- Avoid Node-only assumptions in macro code that is expected to run inside Foundry VTT.
- If a macro is meant to run in the Foundry runtime, it should follow Foundry API conventions rather than browser or Node conventions unless the file is explicitly a shim or local test helper.
- Use concise JSDoc when it improves readability: summarize a function's purpose and document non-obvious parameters, return values, or side effects. Keep inline comments focused on non-obvious reasoning rather than narrating straightforward code.
- Favor explicit, descriptive names for helpers and utility functions.

## Testing requirements

- Add or update unit tests for every macro, covering its meaningful behavior and expected outcomes.
- Use Node.js's built-in `node:test` runner and `node:assert/strict`; do not add a third-party test framework unless requested.
- Put tests under `test/` in files named `*.test.js`, and run them with `node --test`.
- Test macros outside a live Foundry session by providing focused test doubles for the Foundry globals they use.
- Assert observable behavior; syntax checks or loading a macro without assertions do not count as unit tests.
- Keep test doubles minimal, and do not treat them as proof that the real Foundry runtime behaves identically.

## Documentation requirements

- Update the relevant README when adding a new macro category, script pattern, or shim behavior.
- When a user asks for a new macro, include a brief description of what it does, expected Foundry globals, and any setup requirements.
- Link to the official Foundry VTT API docs when behavior depends on that API surface.

## Reference

- Foundry VTT API: <https://foundryvtt.com/api/>

## Examples of accepted work

- A macro that logs a message to the console and uses documented Foundry APIs.
- Small helper functions for common macro patterns.
- Minimal shims that expose just the globals a macro needs.

## Examples of discouraged work

- Heavy build tooling or bundlers for simple macro scripts.
- Broad over-engineering or frameworks that are not needed for a Foundry macro project.
- Replacing actual Foundry runtime behavior with assumptions that are not documented by the API.
