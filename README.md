# FoundryVTT Macros

This repository contains a collection of macros for FoundryVTT, designed to enhance gameplay and streamline interactions within the platform. The macros are implemented in JavaScript and utilize the FoundryVTT API for various functionalities.

## Project Structure

- **macros/**: Contains the macro scripts and utilities.
  - **utilities/**: Includes utility functions and examples.
    - `hello-world.js`: A simple macro that logs "Hello, World!" to the console.
  - `README.md`: Documentation for the macros directory.

- **shims/**: Contains shims or wrappers around the FoundryVTT API.
  - `foundry-api.js`: Simplifies interactions with the FoundryVTT API.

- **test/**: Contains unit tests for the macros.
- **package.json**: Configuration file for npm, listing dependencies and scripts.
- **AGENTS.md**: Shared project guidance for coding agents.
- **.cspell.json**: Configuration file for the Code Spell Checker, specifying custom words and spelling rules.

## Installation

To use these macros, clone the repository and install the necessary dependencies:

```bash
git clone <repository-url>
cd foundryvtt-macros
npm install
```

## Usage

After installing, you can load the macros into your FoundryVTT environment. Refer to the individual macro documentation for specific usage instructions.

## Testing

Macros should have unit tests for their meaningful behavior. Use Node.js's built-in `node:test` runner with assertions from `node:assert/strict`; no additional test framework is required.

Place test files under `test/` with names ending in `.test.js`, then run the suite with:

```bash
# FoundryVTT Macros

This repository contains small JavaScript macros and compatibility shims for Foundry VTT. Macros use the Foundry API and may require a specific Foundry version, module, or active canvas context; check each macro's header and documentation before use.

## Project Structure

- **macros/**: Foundry macro snippets and their [catalog and usage notes](macros/README.md).
- **shims/**: Minimal Foundry API compatibility helpers for local development.
- **test/**: Node.js unit tests for macro behavior outside a live Foundry session.
- **AGENTS.md**: Shared project guidance for coding agents.
- **package.json**: Project metadata and the test command.

## Installation

To use these macros, clone the repository and install the necessary dependencies:

```bash
git clone <repository-url>
cd foundryvtt-macros
npm install
```

## Usage

Load a macro into Foundry VTT using the method appropriate to your setup. Review its header and the [macro documentation](macros/README.md) for its purpose, compatibility requirements, and setup instructions.

## Macro Headers

Every macro should begin with a header describing its purpose and main behavior, authorship, MIT license, independently maintained version, and important runtime requirements. Include enough detail to explain key modes or effects without duplicating full documentation. Macro versions are independent of the package version and of other macros.

## Testing

Add unit tests for each macro's meaningful behavior using Node.js's built-in `node:test` runner and `node:assert/strict`. Put test files in `test/` and name them `*.test.js`. Run the suite from the repository root with:

```bash
npm test
```

Use focused test doubles for Foundry globals so tests can run without a live game session. Tests verify behavior against those doubles; they do not establish that the real Foundry runtime behaves identically.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.

## Links

- [FoundryVTT API Documentation](https://foundryvtt.com/api/)
