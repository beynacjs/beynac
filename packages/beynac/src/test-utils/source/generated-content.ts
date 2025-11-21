import type { SourceProject } from "./SourceProject";

/**
 * Generate the content for generated files by analyzing the source project.
 * Returns an object mapping file names to their generated content.
 */
export function getGeneratedFileContent(project: SourceProject): Record<string, string> {
	return {
		"contracts.ts": generateContractsFileContent(project),
	};
}

/**
 * Generate the content for src/contracts.ts by finding all contract files
 * and creating export statements for each one.
 */
export function generateContractsFileContent(project: SourceProject): string {
	const exports: string[] = [];

	// Find all contract files by filtering all files in the project
	for (const file of project.root.allFiles()) {
		// Match files in contracts/ directories (test files are already filtered out)
		if (file.path.includes("/contracts/")) {
			exports.push(`export { ${file.basenameWithoutExt} } from "./${file.importPath}";`);
		}
	}

	return exports.join("\n") + "\n";
}
