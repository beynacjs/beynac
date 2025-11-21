#!/usr/bin/env bun
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getGeneratedFileContent } from "../src/test-utils/source/generated-content";
import { SourceProject } from "../src/test-utils/source/SourceProject";

async function main() {
	const srcDir = join(import.meta.dir, "..", "src");
	const project = await SourceProject.load(srcDir);
	const generatedFiles = getGeneratedFileContent(project);

	for (const [filename, content] of Object.entries(generatedFiles)) {
		const filePath = join(srcDir, filename);
		await writeFile(filePath, content, "utf-8");

		const lineCount = content.split("\n").filter((l) => l.trim()).length;
		console.log(`✓ Generated ${filePath}`);
		console.log(`  ${lineCount} lines`);
	}
}

main().catch((error) => {
	console.error("Error generating contracts file:", error);
	process.exit(1);
});
