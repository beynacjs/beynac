#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { findMarkdownFiles, processMarkdownFileContent } from "./code-block-utils.ts";

async function main() {
	const docsPath = join(dirname(import.meta.path), "..", "docs");
	console.log(`Updating code blocks in markdown files under ${docsPath}...`);

	let filesProcessed = 0;
	let filesUpdated = 0;
	let blocksUpdated = 0;
	const errors: string[] = [];

	try {
		const markdownFiles = await findMarkdownFiles(docsPath);
		console.log(`Found ${markdownFiles.length} markdown files`);

		for (const filePath of markdownFiles) {
			filesProcessed++;
			const fullPath = join(docsPath, filePath);

			try {
				// Read the markdown file
				const originalContent = readFileSync(fullPath, "utf-8");

				// Derive the test file path
				const testFilePath = fullPath.replace(/\.md$/, "-code.test.ts");

				// Process the content
				const updatedContent = processMarkdownFileContent(originalContent, testFilePath);

				// Check if content changed
				if (updatedContent !== originalContent) {
					writeFileSync(fullPath, updatedContent);
					filesUpdated++;

					// Count how many blocks were updated (rough estimate)
					const originalBlocks = (originalContent.match(/```/g) || []).length / 2;
					const updatedBlocks = (updatedContent.match(/```/g) || []).length / 2;
					blocksUpdated += Math.max(originalBlocks, updatedBlocks);

					console.log(`✓ Updated ${filePath}`);
				} else {
					console.log(`- No changes needed for ${filePath}`);
				}
			} catch (error) {
				const errorMsg = `Error processing ${filePath}: ${error}`;
				errors.push(errorMsg);
				console.error(`✗ ${errorMsg}`);
			}
		}

		// Print summary
		console.log("\n=== Summary ===");
		console.log(`Files processed: ${filesProcessed}`);
		console.log(`Files updated: ${filesUpdated}`);
		console.log(`Code blocks updated: ~${blocksUpdated}`);

		if (errors.length > 0) {
			console.log(`\nErrors encountered: ${errors.length}`);
			errors.forEach((err) => console.error(`  - ${err}`));
			process.exit(1);
		}

		console.log("\n✅ Code block update completed successfully!");
	} catch (error) {
		console.error("Fatal error:", error);
		process.exit(1);
	}
}

// Run the script
main().catch((error) => {
	console.error("Unhandled error:", error);
	process.exit(1);
});
