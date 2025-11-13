import { createHash } from "node:crypto";
import type * as fsSync from "node:fs";
import { createReadStream } from "node:fs";
import * as fs from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import type {
	StorageEndpoint,
	StorageEndpointFileInfoResult,
	StorageEndpointFileReadResult,
	StorageEndpointWriteOptions,
} from "../../../contracts/Storage";
import { BaseClass } from "../../../utils";
import { joinSlashPaths } from "../../file-names";
import { NotFoundError, PermissionsError, StorageUnknownError } from "../../storage-errors";

/**
 * Configuration for the filesystem driver
 */
export interface FilesystemStorageDriverConfig {
	/**
	 * Root directory where files are stored on disk.
	 * All storage paths will be relative to this directory.
	 */
	rootPath: string;

	/**
	 * Name of this endpoint for identification purposes.
	 * Default: "filesystem"
	 */
	name?: string | undefined;

	/**
	 * Public URL prefix for generating download URLs.
	 * Required for url() method.
	 * If not provided, url() will throw an error.
	 *
	 * @example
	 * publicUrlPrefix: "https://cdn.example.com/files"
	 */
	publicUrlPrefix?: string | undefined;

	/**
	 * Function to generate signed download URLs.
	 * Required for signedUrl() method.
	 * If not provided, signedUrl() will throw an error.
	 *
	 * @example
	 * getSignedDownloadUrl: ({ path, expires, downloadFileName, config }) => {
	 *   const signature = generateHMAC(path + expires);
	 *   return `https://cdn.example.com${path}?expires=${expires}&sig=${signature}`;
	 * }
	 */
	getSignedDownloadUrl?:
		| ((params: {
				path: string;
				expires: Date;
				downloadFileName?: string | undefined;
				config: FilesystemStorageDriverConfig;
		  }) => string | Promise<string>)
		| undefined;

	/**
	 * Function to generate signed upload URLs.
	 * Required for uploadUrl() method.
	 * If not provided, uploadUrl() will throw an error.
	 *
	 * @example
	 * getSignedUploadUrl: ({ path, expires, config }) => {
	 *   const signature = generateHMAC(path + expires);
	 *   return `https://cdn.example.com${path}?upload=true&expires=${expires}&sig=${signature}`;
	 * }
	 */
	getSignedUploadUrl?:
		| ((params: {
				path: string;
				expires: Date;
				config: FilesystemStorageDriverConfig;
		  }) => string | Promise<string>)
		| undefined;
}

/**
 * Filesystem storage driver for local file storage
 */
export class FilesystemStorageDriver extends BaseClass implements StorageEndpoint {
	readonly #rootPath: string;
	readonly #publicUrlPrefix: string | undefined;
	readonly #config: FilesystemStorageDriverConfig;

	readonly name: string;

	constructor(config: FilesystemStorageDriverConfig) {
		super();
		this.name = config.name ?? "filesystem";
		this.#rootPath = config.rootPath;
		this.#publicUrlPrefix = config.publicUrlPrefix;
		this.#config = config;
	}

	get invalidNameChars(): string {
		return '<>:"/\\|?*';
	}

	get supportsMimeTypes(): boolean {
		return false;
	}

	async writeSingle({ data, path }: StorageEndpointWriteOptions): Promise<void> {
		const fsPath = this.#toFilesystemPath(path);
		const buffer = await new Response(data).arrayBuffer();

		await withNodeErrors(path, async () => {
			await this.#ensureParentDirectoryExists(fsPath);
			await fs.writeFile(fsPath, new Uint8Array(buffer));
		});
	}

	async readSingle(path: string): Promise<StorageEndpointFileReadResult> {
		const fsPath = this.#toFilesystemPath(path);

		return await withNodeErrors(path, async () => {
			const stats = await fs.stat(fsPath);
			const nodeStream = createReadStream(fsPath);
			const webStream = Readable.toWeb(nodeStream);
			const wrappedStream = wrapStreamErrors(webStream, (error) => convertNodeError(error, path));
			return {
				contentLength: stats.size,
				mimeType: null,
				etag: this.#generateEtag(stats),
				data: wrappedStream,
			};
		});
	}

	async getInfoSingle(path: string): Promise<StorageEndpointFileInfoResult> {
		const fsPath = this.#toFilesystemPath(path);

		const stats = await withNodeErrors(path, () => fs.stat(fsPath));

		return {
			contentLength: stats.size,
			mimeType: null,
			etag: this.#generateEtag(stats),
		};
	}

	async existsSingle(path: string): Promise<boolean> {
		const fsPath = this.#toFilesystemPath(path);
		return fs.exists(fsPath);
	}

	async deleteSingle(path: string): Promise<void> {
		const fsPath = this.#toFilesystemPath(path);
		await withNodeErrors(path, () => fs.unlink(fsPath));
	}

	async copy(source: string, destination: string): Promise<void> {
		const sourceFsPath = this.#toFilesystemPath(source);
		const destFsPath = this.#toFilesystemPath(destination);

		await withNodeErrors(source, async () => {
			await this.#ensureParentDirectoryExists(destFsPath);
			await fs.copyFile(sourceFsPath, destFsPath);
		});
	}

	async move(source: string, destination: string): Promise<void> {
		const sourceFsPath = this.#toFilesystemPath(source);
		const destFsPath = this.#toFilesystemPath(destination);

		await withNodeErrors(source, async () => {
			await this.#ensureParentDirectoryExists(destFsPath);
			await fs.rename(sourceFsPath, destFsPath);
		});
	}

	async getPublicDownloadUrl(path: string, downloadFileName?: string): Promise<string> {
		if (!this.#publicUrlPrefix) {
			throw new Error("publicUrlPrefix is required for URL generation");
		}

		const baseUrl = joinSlashPaths(this.#publicUrlPrefix, path);
		if (downloadFileName) {
			return `${baseUrl}?download=${encodeURIComponent(downloadFileName)}`;
		}
		return baseUrl;
	}

	async getSignedDownloadUrl(
		path: string,
		expires: Date,
		downloadFileName?: string,
	): Promise<string> {
		if (!this.#config.getSignedDownloadUrl) {
			throw new Error("getSignedDownloadUrl is required for signed URL generation");
		}
		return await this.#config.getSignedDownloadUrl({
			path,
			expires,
			downloadFileName,
			config: this.#config,
		});
	}

	async getTemporaryUploadUrl(path: string, expires: Date): Promise<string> {
		if (!this.#config.getSignedUploadUrl) {
			throw new Error("getSignedUploadUrl is required for signed upload URL generation");
		}
		return await this.#config.getSignedUploadUrl({
			path,
			expires,
			config: this.#config,
		});
	}

	async existsAnyUnderPrefix(prefix: string): Promise<boolean> {
		// Only check for files, not empty directories
		const generator = this.list(prefix, true, true);
		const first = await generator.next();
		return !first.done;
	}

	async *listEntries(prefix: string): AsyncGenerator<string, void> {
		yield* this.list(prefix, false, false);
	}

	async *listFilesRecursive(prefix: string): AsyncGenerator<string, void> {
		yield* this.list(prefix, true, true);
	}

	async deleteAllUnderPrefix(prefix: string): Promise<void> {
		const files: string[] = [];

		for await (const file of this.listFilesRecursive(prefix)) {
			files.push(file);
		}

		for (const file of files) {
			const fullPath = `${prefix}${file}`;
			await this.deleteSingle(fullPath);
		}
	}

	/**
	 * Core list implementation that buffers results in memory
	 */
	private async *list(
		prefix: string,
		filesOnly: boolean,
		recursive: boolean,
	): AsyncGenerator<string, void> {
		const fsPrefix = this.#toFilesystemPath(prefix);
		const results: string[] = [];

		// Recursively collect all entries
		await this.#collectEntries(fsPrefix, "", filesOnly, recursive, results);

		// Sort and yield
		results.sort();
		for (const entry of results) {
			yield entry;
		}
	}

	/**
	 * Recursively collect entries
	 */
	async #collectEntries(
		fsBasePath: string,
		relativePath: string,
		filesOnly: boolean,
		recursive: boolean,
		results: string[],
	): Promise<void> {
		const currentPath = relativePath ? join(fsBasePath, relativePath) : fsBasePath;

		const entries = await withNodeErrors(currentPath, () =>
			fs.readdir(currentPath, { withFileTypes: true }),
		);

		for (const entry of entries) {
			const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

			if (entry.isDirectory()) {
				if (recursive) {
					// Recurse into directory
					await this.#collectEntries(fsBasePath, entryRelativePath, filesOnly, recursive, results);
				} else {
					// Add directory entry (non-recursive)
					if (!filesOnly) {
						results.push(`${entryRelativePath}/`);
					}
				}
			} else if (entry.isFile()) {
				results.push(entryRelativePath);
			}
		}
	}

	/**
	 * Convert storage path to filesystem path
	 */
	#toFilesystemPath(storagePath: string): string {
		// Remove leading slash and join with root path
		const relativePath = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
		return join(this.#rootPath, relativePath);
	}

	async #ensureParentDirectoryExists(path: string): Promise<void> {
		await fs.mkdir(dirname(path), { recursive: true });
	}

	/**
	 * Generate ETag from file stats (hash of mtime + size)
	 */
	#generateEtag(stats: fsSync.Stats): string {
		const data = `${stats.mtimeMs}-${stats.size}`;
		return createHash("sha256").update(data).digest("hex");
	}
}

/**
 * Create filesystem-backed storage
 */
export function filesystemStorage(config: FilesystemStorageDriverConfig): StorageEndpoint {
	return new FilesystemStorageDriver(config);
}

/**
 * Convert Node.js filesystem errors to storage errors
 */
const convertNodeError = (error: unknown, path: string): Error => {
	if (typeof error === "object" && error !== null && "code" in error) {
		const code = (error as { code: string }).code;
		if (code === "ENOENT" || code === "ENOTDIR") {
			return new NotFoundError(path);
		}
		if (code === "EACCES") {
			return new PermissionsError(path, 0, "EACCES");
		}
	}
	return new StorageUnknownError(`operate on ${path}`, error);
};

/**
 * Wraps a ReadableStream to intercept and convert errors using the provided converter function
 */
function wrapStreamErrors(
	stream: ReadableStream<Uint8Array>,
	convertError: (error: unknown) => Error,
): ReadableStream<Uint8Array> {
	const reader = stream.getReader();

	return new ReadableStream({
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					controller.close();
				} else {
					controller.enqueue(value);
				}
			} catch (error) {
				controller.error(convertError(error));
			}
		},
		cancel(reason) {
			return reader.cancel(reason);
		},
	});
}

async function withNodeErrors<T>(path: string, fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		throw convertNodeError(error, path);
	}
}
