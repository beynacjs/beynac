#!/usr/bin/env bun
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Glob } from "bun";

/**
 * Generate the content for src/contracts.ts by finding all contract files
 * and creating export statements for each one.
 */
export function generateContractsFileContent(srcDir: string): string {
	const glob = new Glob("**/contracts/*.ts");
	const contractFiles: string[] = [];

	// Find all contract files
	for (const file of glob.scanSync(srcDir)) {
		// Convert to relative path from src/ and remove .ts extension
		const modulePath = file.replace(/\.ts$/, "");
		contractFiles.push(modulePath);
	}

	// Sort for consistent output
	contractFiles.sort();

	// Generate export statements
	const exports = contractFiles.map((path) => `export * from "./${path}";`).join("\n");

	return exports + "\n";
}

async function main() {
	const srcDir = join(import.meta.dir, "..", "src");
	const contractsFilePath = join(srcDir, "contracts.ts");

	const content = generateContractsFileContent(srcDir);

	await writeFile(contractsFilePath, content, "utf-8");

	console.log(`✓ Generated ${contractsFilePath}`);
	console.log(`  Found ${content.split("\n").filter((l) => l.trim()).length} contract files`);
}

// Only run main() when this script is executed directly, not when imported
if (import.meta.main) {
	main().catch((error) => {
		console.error("Error generating contracts file:", error);
		process.exit(1);
	});
}
