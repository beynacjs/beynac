import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import {
	findMarkdownFiles,
	getExpectedCodeForBlockFromContent,
	parseMarkdownFile,
} from "./code-block-utils.ts";

const docsPath = join(dirname(import.meta.path), "..", "docs");

test("validate code blocks", async () => {
	const markdownFiles = await findMarkdownFiles(docsPath);

	for (const filePath of markdownFiles) {
		const fullPath = join(docsPath, filePath);
		const content = readFileSync(fullPath, "utf-8");
		const blocks = parseMarkdownFile(content);

		// Check for missing source comments
		for (let i = 0; i < blocks.length; i++) {
			expect(blocks[i].source).toBeTruthy();
		}

		// Process non-manual blocks
		const nonManualBlocks = blocks.filter((b) => b.source && b.source !== "manual");
		if (nonManualBlocks.length === 0) continue;

		// Check if test file exists
		const testFilePath = fullPath.replace(/\.md$/, "-code.test.ts");
		if (nonManualBlocks.length > 0) {
			expect(existsSync(testFilePath)).toBe(true);
		}
		if (!existsSync(testFilePath)) continue;

		// Validate each non-manual block
		for (const block of nonManualBlocks) {
			if (!block.source) continue;

			const testContent = readFileSync(testFilePath, "utf-8");
			const expectedCode = getExpectedCodeForBlockFromContent(testContent, block.source);
			const actualCode = block.content.trim();

			// Use expect for better error reporting
			expect(actualCode).toBe(expectedCode);
		}
	}
});
