import { readFile } from "node:fs/promises";
import path, { relative } from "node:path";
import { BaseClass } from "../../utils";
import { type Import, parseImports } from "./parseSource";
import { SourceExport } from "./SourceExport";
import type { SourceFolder } from "./SourceFolder";
import type { SourceProject } from "./SourceProject";

/**
 * Represents a source file with its exports.
 */
export class SourceFile extends BaseClass {
	path: string;
	source: string;
	exports: SourceExport[];
	imports: Import[];
	isBarrel: boolean;
	isTestFile: boolean;
	project!: SourceProject;
	folder: SourceFolder;

	constructor(
		path: string,
		source: string,
		exports: SourceExport[],
		imports: Import[],
		isBarrel: boolean,
		isTestFile: boolean,
		folder: SourceFolder,
	) {
		super();
		this.path = path;
		this.source = source;
		this.exports = exports;
		this.imports = imports;
		this.isBarrel = isBarrel;
		this.isTestFile = isTestFile;
		this.folder = folder;
		// Set file reference on all exports
		for (const exp of exports) {
			exp.file = this;
		}
	}

	/**
	 * The path used for importing this file (no extension, barrel files use folder path).
	 */
	get importPath(): string {
		if (this.isBarrel) {
			const lastSlash = this.path.lastIndexOf("/");
			return lastSlash === -1 ? "." : this.path.substring(0, lastSlash);
		}
		return this.path.replace(/\.tsx?$/, "");
	}

	get basename(): string {
		return path.basename(this.path);
	}

	get basenameWithoutExt(): string {
		return path.basename(this.path).replace(/\.\w+?$/, "");
	}

	protected override getToStringExtra(): string | undefined {
		return this.path;
	}

	/**
	 * Gets an export by name. Throws if not found.
	 */
	getExport(name: string): SourceExport {
		const exp = this.exports.find((e) => e.name === name);
		if (!exp) {
			throw new Error(`Export '${name}' not found in ${this.path}`);
		}
		return exp;
	}

	/**
	 * Returns true if this file is a public API entry point.
	 */
	isEntryPoint(): boolean {
		return this.project.entryPoints.has(this.path);
	}

	/**
	 * Loads a source file and extracts its exports.
	 */
	static async load(
		filePath: string,
		projectRoot: string,
		folder: SourceFolder,
	): Promise<SourceFile> {
		const path = relative(projectRoot, filePath);
		const content = await readFile(filePath, "utf-8");
		const isBarrel = path.endsWith("/index.ts") || path.endsWith("/index.tsx");
		const isTestFile = content.includes("bun:test");

		if (isTestFile) {
			return new SourceFile(path, content, [], [], isBarrel, true, folder);
		}

		// Load runtime module and extract exports
		const runtimeModule = await import(filePath);

		// Compute importPath for type symbols
		let importPath: string;
		if (isBarrel) {
			const lastSlash = path.lastIndexOf("/");
			importPath = lastSlash === -1 ? "." : path.substring(0, lastSlash);
		} else {
			importPath = path.replace(/\.tsx?$/, "");
		}

		const exports = SourceExport.extractFromSource(content, runtimeModule, importPath);
		const imports = parseImports(content);

		return new SourceFile(path, content, exports, imports, isBarrel, false, folder);
	}
}
