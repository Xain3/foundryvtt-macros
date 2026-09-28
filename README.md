# FoundryVTT Macros

This repository contains a collection of macros for FoundryVTT, designed to enhance gameplay and streamline interactions within the platform. The macros are implemented in JavaScript and utilize the FoundryVTT API for various functionalities.

## Project Structure

- **macros/**: Contains the macro scripts and utilities.
  - **utilities/**: Includes utility functions and examples.
    - `hello-world.js`: A simple macro that logs "Hello, World!" to the console.
  - `README.md`: Documentation for the macros directory.

- **shims/**: Contains shims or wrappers around the FoundryVTT API.
  - `foundry-api.js`: Simplifies interactions with the FoundryVTT API.

- **package.json**: Configuration file for npm, listing dependencies and scripts.

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
node --test
```

Stub the Foundry globals a macro needs so tests can run without a live Foundry session. These stubs verify the macro's behavior against the test setup, not the actual Foundry runtime.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.

## Links

- [FoundryVTT API Documentation](https://foundryvtt.com/api/)
