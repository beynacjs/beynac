# Agent Instructions for Beynac

When I ask questions, answer briefly to minimise time taken to read response. I'll ask for more information if I need it.

## General instructions for tasks

- After you have finished a task, run the formatter then check for issues with `bun check`. Only fix issues that are related to the code you're working on. If there are unrelated lint or test issues elsewhere in the codebase report them but no not fix them.
- Once the tests and lint check have passed, review your code for issues and potential improvements but DO NOT make them yet. Report these to me and let me decide if I want to make the changes.

## Coding guidelines

- The linter is there to prevent you from using bad patterns. Try not to add lint disable comments.
- In particular, try to avoid use of `any`. Use `unknown` where possible. When an assignment breaks type checking, think carefully about how to write the code in a type safe way. If this really isn't possible, avoid `foo = bar as any`, use `foo = bar as TheCorrectType`
- When writing tests, pass the function or class under test to the first argument describe, e.g. `describe(myFunc, ...)` not `describe("myFunc", ...)`
- in bun, expect never returns a promise, do not `await expect(...)` just use `expect(...)`

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
- **Apply correct formatting to files**: `bun format` - IMPORTANT: always run checks (`bun check`) THEN format (`bun format`) after completing functionality changes
