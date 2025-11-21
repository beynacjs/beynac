import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ENTRY_POINTS } from "./test-utils/entryPoints";
import { getGeneratedFileContent } from "./test-utils/source/generated-content";
import { getFileErrors } from "./test-utils/source/getFileErrors";
import { SourceProject } from "./test-utils/source/SourceProject";

const srcDir = join(import.meta.dir);
const project = await SourceProject.load(srcDir, Object.values(ENTRY_POINTS));
const filePaths = project.root.allFiles().map((f) => f.path);
const generatedFiles = Object.keys(getGeneratedFileContent(project));

describe("codebase invariants", () => {
	test.each(filePaths)("%s", (path) => {
		const file = project.getFile(path);
		const errors = getFileErrors(file);
		expect(errors).toEqual([]);
	});

	test.each(generatedFiles)("src/%s matches generated content", async (filename) => {
		const normaliseCode = (code: string) => code.replaceAll(/[,{}]\s+/g, " ");

		const expectedContent = normaliseCode(getGeneratedFileContent(project)[filename]);
		const filePath = join(srcDir, filename);
		const actualContent = normaliseCode(await readFile(filePath, "utf-8"));

		expect(
			actualContent,
			`src/${filename} content does not match generated content. Run 'bun run regenerate-contracts' to update it.\n\nExpected:\n${expectedContent}\n\nActual:\n${actualContent}`,
		).toEqual(expectedContent);
	});
});
