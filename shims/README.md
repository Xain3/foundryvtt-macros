# Shims

This folder contains lightweight compatibility shims for running Foundry VTT macro code in a local development or editor environment.

## Purpose

Foundry macros normally execute inside the Foundry VTT runtime, where globals such as `game`, `canvas`, `ui`, and `TokenDocument` are available. These shims provide a minimal set of mock objects so the code is easier to understand, lint, and test outside the game client.

They are not a replacement for the real Foundry runtime, and they should not be used in production game sessions.

## Files

- `foundry-api.js` – a minimal API stub that exposes common Foundry globals and helper objects for local scripting.

## Usage

Import or load the shim before running a macro that expects Foundry globals:

```js
import './shims/foundry-api.js';

// Your macro code here
console.log(game); // available via the shim
```

If you are using a plain script in a browser or Node-like environment, load the shim first so the expected global objects exist.

## Notes

- Keep the shims intentionally small and explicit.
- Add only the globals that a macro actually needs.
- Prefer real Foundry runtime behavior when running inside the game itself.
- This project is meant for macro experimentation and local tooling, not for shipping production game logic.

## Reference

For the authoritative runtime contract, see the Foundry VTT API docs:

<https://foundryvtt.com/api/>
