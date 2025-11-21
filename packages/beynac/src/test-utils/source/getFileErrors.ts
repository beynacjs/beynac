import { BeynacError } from "../../core/core-errors";
import { BeynacEvent } from "../../core/core-events";
import { isMockable } from "../../testing/mocks";
import { BaseClass, getPrototypeChain } from "../../utils";
import type { SourceFile } from "./SourceFile";

/**
 * Returns an array of error messages for invariant violations in a source file.
 */
export function getFileErrors(file: SourceFile): string[] {
	const errors: string[] = [];

	for (const exp of file.exports) {
		if (exp.kind === "class") {
			const chain = getPrototypeChain(exp.runtimeValue);
			const extendsBaseClass = chain.includes(BaseClass);
			const extendsBeynacError = chain.includes(BeynacError);
			const extendsBeynacEvent = chain.includes(BeynacEvent);
			const endsWithError = exp.name.endsWith("Error");
			const endsWithEvent = exp.name.endsWith("Event");

			if (endsWithError) {
				if (!extendsBeynacError) {
					errors.push(
						`${exp.name} in ${file.path} ends with "Error" but does not extend BeynacError`,
					);
				}

				const moduleName = file.folder.basename;
				const expectedPath = `${moduleName}/${moduleName}-errors.ts`;
				if (!file.path.endsWith(expectedPath)) {
					errors.push(
						`${exp.name} in ${file.path} is an Error so should be defined in ${expectedPath}`,
					);
				}

				const exportFiles = exp.getAliases().map((e) => e.file.path);
				const expectedExportFiles = ["errors.ts", `${moduleName}/${moduleName}-entry-point.ts`];
				if (!setsEqual(exportFiles, expectedExportFiles)) {
					errors.push(
						`${exp.name} in ${file.path} should be exported twice in ${expectedExportFiles.join(" and ")}, but the files exporting it are: ${exportFiles.join(", ")}`,
					);
				}
			} else {
				if (extendsBeynacError) {
					errors.push(
						`${exp.name} in ${file.path} extends BeynacError but does not end with "Error"`,
					);
				}
			}

			if (endsWithEvent) {
				if (!extendsBeynacEvent) {
					errors.push(
						`${exp.name} in ${file.path} ends with "Event" but does not extend BeynacEvent`,
					);
				}

				const moduleName = file.folder.basename;
				const expectedPath = `${moduleName}/${moduleName}-events.ts`;
				if (!file.path.endsWith(expectedPath)) {
					errors.push(
						`${exp.name} in ${file.path} is an Event so should be defined in ${expectedPath}`,
					);
				}

				const exportFiles = exp.getAliases().map((e) => e.file.path);
				const expectedExportFiles = ["events.ts", `${moduleName}/${moduleName}-entry-point.ts`];
				if (!setsEqual(exportFiles, expectedExportFiles)) {
					errors.push(
						`${exp.name} in ${file.path} should be exported twice in ${expectedExportFiles.join(" and ")}, but the files exporting it are: ${exportFiles.join(", ")}`,
					);
				}
			} else {
				if (extendsBeynacEvent) {
					errors.push(
						`${exp.name} in ${file.path} extends BeynacEvent but does not end with "Event"`,
					);
				}
			}

			// Check base class requirement
			if (!extendsBaseClass && !extendsBeynacError && !extendsBeynacEvent) {
				errors.push(
					`${exp.name} in ${file.path} should extend BaseClass, BeynacError, or BeynacEvent`,
				);
			}
		}

		// Check mockable functions (can be exported as const or function)
		if (typeof exp.runtimeValue === "function") {
			const fn = exp.runtimeValue as Function;
			if (isMockable(fn) && fn.name !== exp.name) {
				errors.push(
					`${exp.name} in ${file.path} is mockable but has name "${fn.name}" instead of "${exp.name}"`,
				);
			}
		}

		// Check barrel file rename violations
		if (file.isBarrel && exp.reexport && exp.reexport.originalName !== exp.name) {
			errors.push(
				`Barrel file ${file.path} renames export "${exp.name}". Use 'export { foo }' not 'export { foo as bar }'`,
			);
		}

		// Check barrel file parent directory re-exports
		if (file.isBarrel && exp.reexport && exp.reexport.originalFile.startsWith("..")) {
			errors.push(
				`Barrel file ${file.path} re-exports from parent directory "${exp.reexport.originalFile}". Barrel files should only re-export from the current directory or subdirectories.`,
			);
		}

		const checkPublicApiDoc = !exp.isPrimitive && !exp.reexport;
		if (checkPublicApiDoc && exp.project.entryPoints.size > 0) {
			// Check public API doc comments (skip re-exports - doc should be on original)
			if (exp.isPublicApi() && !exp.isDocumented()) {
				errors.push(
					`${exp.name} in ${file.path} is part of the public API but has no doc comment.`,
				);
			}

			// Check non-public API exports with doc comments (only when entry points are defined)
			if (!exp.isPublicApi() && exp.isDocumented()) {
				errors.push(
					`${exp.name} in ${file.path} is not part of the public API but has a doc comment. Remove the comment (preferred unless we're explaining something really important that's not clear from the name).`,
				);
			}
		}
	}

	// Check doc comments for proper whitespace and export following
	const docCommentPattern =
		/(\S?)(\s*)\/\*\*(?:[^*]|\*(?!\/))*\*\/(\n*)(export|type|interface|[ \t]+)?/g;
	let match;
	while ((match = docCommentPattern.exec(file.source)) !== null) {
		// Skip JSX pragma comments (e.g., @jsxImportSource)
		if (match[0].includes("@jsxImportSource")) {
			continue;
		}

		const charBefore = match[1];
		const whitespaceBefore = match[2];
		const newlinesAfter = match[3];
		const exportOrIndent = match[4];

		// Calculate line numbers for the doc comment
		const commentStart = match.index + charBefore.length + whitespaceBefore.length;
		const commentEnd =
			match.index + match[0].length - (newlinesAfter + (exportOrIndent || "")).length;
		const startLine = file.source.slice(0, commentStart).split("\n").length;
		const endLine = file.source.slice(0, commentEnd).split("\n").length;
		const lineRange = startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;

		// Check whitespace before has at least 2 newlines (unless at start of file, after {, or indented)
		const newlinesBefore = (whitespaceBefore.match(/\n/g) || []).length;
		const isIndented = /[ \t]/.test(whitespaceBefore);
		if (newlinesBefore < 2 && charBefore !== "" && charBefore !== "{" && !isIndented) {
			errors.push(
				`${file.path}:${lineRange} has ${newlinesBefore} newline${newlinesBefore === 1 ? "" : "s"} before doc comment (minimum 2 required)`,
			);
		}

		// Check whitespace after has at least 1 newline
		const newlinesAfterCount = (newlinesAfter.match(/\n/g) || []).length;
		if (newlinesAfterCount < 1) {
			errors.push(
				`${file.path}:${lineRange} has ${newlinesAfterCount} newlines after doc comment (minimum 1 required)`,
			);
		}

		// Doc comments must apply to (be directly before) an export statement, type, interface or indented content
		if (!exportOrIndent) {
			errors.push(
				`${file.path}:${lineRange} doc comment not followed by export statement, type, or indented content`,
			);
		}
	}

	// Check for imports from central contracts.ts file
	for (const imp of file.imports) {
		if (imp.path.endsWith("/contracts")) {
			errors.push(
				`${file.path} imports from the central contracts.ts file. Import from module-specific contract files instead.`,
			);
			break;
		}
	}

	// Check for imports with file extensions
	for (const imp of file.imports) {
		if (/\.[jt]sx?/.test(imp.path)) {
			errors.push(
				`${file.path} imports "${imp.path}" with file extension. Import paths should not include .js or .ts extensions.`,
			);
		}
	}

	// Check for re-exports with file extensions
	for (const exp of file.exports) {
		if (exp.reexport) {
			const originalFile = exp.reexport.originalFile;
			if (originalFile.endsWith(".js") || originalFile.endsWith(".ts")) {
				errors.push(
					`${file.path} imports "${originalFile}" with file extension. Import paths should not include .js or .ts extensions.`,
				);
			}
		}
	}

	return errors;
}

const setsEqual = <T>(a: T[], b: T[]): boolean => {
	if (a.length !== b.length) return false;
	const aSet = new Set(a);
	return b.every((bItem) => aSet.has(bItem));
};
