import type { SourceProject } from "./SourceProject";

/**
 * Generate the content for generated files by analyzing the source project.
 * Returns an object mapping file names to their generated content.
 */
export function getGeneratedFileContent(project: SourceProject): Record<string, string> {
	return {
		"contracts.ts": generateContractsFileContent(project),
		"errors.ts": generateErrorsFileContent(project),
		"events.ts": generateEventsFileContent(project),
	};
}

/**
 * Generate the content for src/contracts.ts by finding all contract files
 * and creating export statements for each one.
 */
export function generateContractsFileContent(project: SourceProject): string {
	const lines: string[] = [];

	// Find all contract files by filtering all files in the project
	const contractFiles = project.root
		.allFiles()
		.filter((file) => file.path.includes("/contracts/"))
		.sort((a, b) => a.path.localeCompare(b.path));

	for (const file of contractFiles) {
		// Get the contract const export (matches the file basename without extension)
		const expectedContractName = file.basenameWithoutExt;
		const contractExport = file.exports.find(
			(exp) => exp.kind === "const" && exp.name === expectedContractName && !exp.reexport,
		);

		if (contractExport) {
			lines.push(`export { ${contractExport.name} } from "./${file.importPath}";`);
		}
	}

	return lines.join("\n") + "\n";
}

/**
 * Generate the content for src/errors.ts by finding all error files
 * and creating export statements for each one.
 */
export function generateErrorsFileContent(project: SourceProject): string {
	const lines: string[] = [];

	// Find all error files
	const errorFiles = project.root
		.allFiles()
		.filter((file) => file.path.endsWith("-errors.ts") && !file.path.includes("__fixtures__"))
		.sort((a, b) => a.path.localeCompare(b.path));

	for (const file of errorFiles) {
		// Get all error class exports that are not re-exports
		const errorExports = file.exports
			.filter((exp) => exp.kind === "class" && !exp.reexport && exp.name.endsWith("Error"))
			.map((exp) => exp.name)
			.sort();

		if (errorExports.length > 0) {
			lines.push(`export { ${errorExports.join(", ")} } from "./${file.importPath}";`);
		}
	}

	return lines.join("\n") + "\n";
}

/**
 * Generate the content for src/events.ts by finding all event files
 * and creating export statements for each one.
 */
export function generateEventsFileContent(project: SourceProject): string {
	const lines: string[] = [];

	// Find all event files
	const eventFiles = project.root
		.allFiles()
		.filter((file) => file.path.endsWith("-events.ts") && !file.path.includes("__fixtures__"))
		.sort((a, b) => a.path.localeCompare(b.path));

	for (const file of eventFiles) {
		// Get all event class exports that are not re-exports
		const eventExports = file.exports
			.filter((exp) => exp.kind === "class" && !exp.reexport && exp.name.endsWith("Event"))
			.map((exp) => exp.name)
			.sort();

		if (eventExports.length > 0) {
			lines.push(`export { ${eventExports.join(", ")} } from "./${file.importPath}";`);
		}
	}

	return lines.join("\n") + "\n";
}
