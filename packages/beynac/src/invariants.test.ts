import { describe, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BeynacError } from "./error";
import { BeynacEvent } from "./event";
import { BaseClass, getPrototypeChain } from "./utils";

function findTypeScriptFiles(dir: string): string[] {
	const results: string[] = [];

	const entries = readdirSync(dir);

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			results.push(...findTypeScriptFiles(fullPath));
		} else if (
			(entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
			!entry.endsWith(".d.ts") &&
			!entry.includes(".test.")
		) {
			results.push(fullPath);
		}
	}

	return results;
}

const srcDir = join(import.meta.dir);
const tsFiles = findTypeScriptFiles(srcDir).filter((filePath) => !filePath.includes("/vendor/"));

// Pre-load all modules
type FileExports = {
	filePath: string;
	relativePath: string;
	exports: [string, unknown][];
};

const fileExports: FileExports[] = await Promise.all(
	tsFiles.map(async (filePath): Promise<FileExports> => {
		const relativePath = filePath.substring(srcDir.length + 1);
		try {
			const moduleExports = await import(filePath);
			const exportEntries = Object.entries(moduleExports).filter(
				([, exportValue]) =>
					typeof exportValue === "function" && exportValue.toString().startsWith("class "),
			);
			return { filePath, relativePath, exports: exportEntries };
		} catch {
			// Skip files that can't be imported
			return { filePath, relativePath, exports: [] };
		}
	}),
);

describe.each(fileExports)("$relativePath invariants", ({ exports }) => {
	if (exports.length === 0) {
		test("has no exported classes", () => {
			// Empty test for files with no classes
		});
		return;
	}

	test.each(exports)("class %s base", (exportName, exportValue) => {
		// Get the prototype chain
		const chain = getPrototypeChain(exportValue as object);

		// Check if BaseClass, BeynacError, or BeynacEvent is in the chain
		const extendsBaseClass = chain.includes(BaseClass);
		const extendsBeynacError = chain.includes(BeynacError);
		const extendsBeynacEvent = chain.includes(BeynacEvent);

		const endsWithError = exportName.endsWith("Error");
		const endsWithEvent = exportName.endsWith("Event");

		if (endsWithError && !extendsBeynacError) {
			throw new Error(`${exportName} ends with "Error" but does not extend BeynacError`);
		}

		if (extendsBeynacError && !endsWithError) {
			throw new Error(`${exportName} extends BeynacError but does not end with "Error"`);
		}

		if (endsWithEvent && !extendsBeynacEvent) {
			throw new Error(`${exportName} ends with "Event" but does not extend BeynacEvent`);
		}

		if (extendsBeynacEvent && !endsWithEvent) {
			throw new Error(`${exportName} extends BeynacEvent but does not end with "Event"`);
		}

		if (!extendsBaseClass && !extendsBeynacError && !extendsBeynacEvent) {
			throw new Error(`${exportName} should extend BaseClass, BeynacError, or BeynacEvent`);
		}
	});
});
