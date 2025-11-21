import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { getFileErrors } from "./getFileErrors";
import { SourceProject } from "./SourceProject";

const fixturesPath = join(import.meta.dir, "__fixtures__");

describe(getFileErrors, () => {
	let project: SourceProject;

	beforeAll(async () => {
		project = await SourceProject.load(fixturesPath);
	});

	test("detects Error naming violations", () => {
		const file = project.getFile("errors/bad-errors.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			'FooError in errors/bad-errors.ts ends with "Error" but does not extend BeynacError',
			'BadErrorExtension in errors/bad-errors.ts extends BeynacError but does not end with "Error"',
		]);
	});

	test("detects Event naming violations", () => {
		const file = project.getFile("errors/bad-events.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			'FooEvent in errors/bad-events.ts ends with "Event" but does not extend BeynacEvent',
			'BadEventExtension in errors/bad-events.ts extends BeynacEvent but does not end with "Event"',
		]);
	});

	test("detects missing base class", () => {
		const file = project.getFile("errors/bad-base-class.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			"Standalone in errors/bad-base-class.ts should extend BaseClass, BeynacError, or BeynacEvent",
		]);
	});

	test("detects mockable function name mismatch", () => {
		const file = project.getFile("errors/bad-mockable-name.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			'exportedName in errors/bad-mockable-name.ts is mockable but has name "wrongName" instead of "exportedName"',
		]);
	});

	test("detects barrel file rename violations", () => {
		const file = project.getFile("errors/bad-barrel-file-reexport/index.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			"Barrel file errors/bad-barrel-file-reexport/index.ts renames export \"RenamedThing\". Use 'export { foo }' not 'export { foo as bar }'",
		]);
	});

	test("detects barrel file parent directory re-exports", () => {
		const file = project.getFile("errors/bad-barrel-file-import/index.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			'Barrel file errors/bad-barrel-file-import/index.ts re-exports from parent directory "../parent-export". Barrel files should only re-export from the current directory or subdirectories.',
		]);
	});

	test("detects badly formatted block comments", () => {
		const file = project.getFile("errors/bad-block-comment.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			"errors/bad-block-comment.ts:12 doc comment not followed by export statement, type, or indented content",
			"errors/bad-block-comment.ts:15-17 doc comment not followed by export statement, type, or indented content",
		]);
	});

	test("detects imports from central contracts.ts file", () => {
		const file = project.getFile("errors/bad-contracts-import.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			"errors/bad-contracts-import.ts imports from the central contracts.ts file. Import from module-specific contract files instead.",
		]);
	});

	test("detects imports with file extensions", () => {
		const file = project.getFile("errors/bad-import-extension.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			// from import
			'errors/bad-import-extension.ts imports "./extension-helper.js" with file extension. Import paths should not include .js or .ts extensions.',
			// from export
			'errors/bad-import-extension.ts imports "./extension-helper.js" with file extension. Import paths should not include .js or .ts extensions.',
		]);
	});

	test("returns empty array for files without violations", () => {
		const file = project.getFile("exports.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([]);
	});
});

describe("public API doc comments", () => {
	let project: SourceProject;

	beforeAll(async () => {
		project = await SourceProject.load(fixturesPath, ["public-api/index.ts"]);
	});

	test("detects missing doc comments on public API exports", () => {
		const file = project.getFile("public-api/undocumented.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			"UndocumentedClass in public-api/undocumented.ts is part of the public API but has no doc comment.",
			"undocumentedFunction in public-api/undocumented.ts is part of the public API but has no doc comment.",
			// UNDOCUMENTED_CONST is excluded - primitives don't need doc comments
			"UndocumentedType in public-api/undocumented.ts is part of the public API but has no doc comment.",
			"UndocumentedInterface in public-api/undocumented.ts is part of the public API but has no doc comment.",
		]);
	});

	test("passes for documented public API exports", () => {
		const file = project.getFile("public-api/documented.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([]);
	});

	test("passes for internal exports without doc comments", () => {
		const file = project.getFile("public-api/internal.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([]);
	});

	test("passes for entry point file with re-exports", () => {
		const file = project.getFile("public-api/index.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([]);
	});

	test("detects doc comments on non-public API exports", () => {
		const file = project.getFile("public-api/non-public-with-doc.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			"NonPublicDocumentedClass in public-api/non-public-with-doc.ts is not part of the public API but has a doc comment. Remove the comment (preferred unless we're explaining something really important that's not clear from the name).",
			"nonPublicDocumentedFunction in public-api/non-public-with-doc.ts is not part of the public API but has a doc comment. Remove the comment (preferred unless we're explaining something really important that's not clear from the name).",
			"NonPublicDocumentedType in public-api/non-public-with-doc.ts is not part of the public API but has a doc comment. Remove the comment (preferred unless we're explaining something really important that's not clear from the name).",
			"NonPublicDocumentedInterface in public-api/non-public-with-doc.ts is not part of the public API but has a doc comment. Remove the comment (preferred unless we're explaining something really important that's not clear from the name).",
		]);
	});
});
