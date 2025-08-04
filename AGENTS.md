# Agent Instructions for Beynac

## General instructions for tasks

- After you have finished a task, run the formatter then check for issues with `bun check`. Only fix issues that are related to the code you're working on. If there are unrelated lint or test issues elsewhere in the codebase report them but no not fix them.
- Once the tests and lint check have passed, review your code for issues and potential improvements but DO NOT make them yet. Report these to me and let me decide if I want to make the changes.

## Soft port process

When asked to follow the "soft port process", you will be given a reference to a TypeScript file. The TypeScript file will contain PHP syntax methods, wrapped in a template string to prevent syntax errors.

Before starting, use Git to check that the workspace has no dirty files. If it does, stop and tell me to commit my work.

**IMPORTANT** DO NOT edit existing code, DO NOT run tests, DO NOT perform type checking. DO NOT edit any existing code, ONLY add new code to the file.

Below each PHP method create an equivalent TS method that I will later review and move out of the template string. The new method should be INSIDE the template string so it will not become part of the TS file or have any semantic effect on the code. When adding the new method: Change PHP syntax to TS syntax; Change PHP data access and manipulation to javascript syntax e.g. `isset(foo)` -> `foo != null`; Add a best guess at the correct types. Match the indentation of the original PHP code.

When converting a test method, convert to bun test syntax where the test name is an english sentence with no initial capital and attempt to preserve casing of identifiers and add apostrophes where appropriate e.g. `public testMyClassDoesntDoSomething() { ... }` becomes `test("MyClass doesn't do something", () => { ... })`

Reminder, because all your work is inside a template string you will NOT be able to verify it, JUST add the code then stop without trying to check if it works.

After you have completed the initial port, go over your work and verify that none of the pre-existing code has been changed, and that the newly generated code is well formed with correct indentation and not missing any statements present in the original PHP. You can use Git to see your changes - there were no uncommitted changes in the workspace before you started, so all changes in a git diff will be yours.

## Build & Test Commands

- **Run unit tests**: `bun test`
- **Run lint and format test**: `bun check:lint`
- **Apply corect formatting to files**: `bun format` - IMPORTANT: always run `bun format` after completing functionality changes

## Code Style Guidelines

- **Language**: TypeScript with strict mode enabled (all strict flags in tsconfig.json)
- **Module system**: ES modules (`"type": "module"`)
- **Runtime**: Bun (use `bun:test` for testing imports)
- **Imports**: Use relative paths with `.ts` extension for local imports
- **Types**: Define explicit types for all parameters and return values
- **Naming**: camelCase for variables/functions, PascalCase for classes/types
- **Error handling**: Throw descriptive Error objects with context
- **Documentation**: Use JSDoc comments for public APIs with @example blocks
- **Testing**: Write comprehensive tests covering edge cases and error scenarios
- **Code organization**: Export main functionality, keep implementation details private
- **Type safety**: Leverage TypeScript's strict mode - avoid `any`, use type guards
- **No console.log**: Use proper error handling instead of logging
