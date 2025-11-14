import { createHash } from "node:crypto";
import type * as fsSync from "node:fs";
import { createReadStream, createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline, Readable } from "node:stream";
import { promisify } from "node:util";

const pipelineAsync = promisify(pipeline);

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

		await withNodeErrors(fsPath, async () => {
			await this.#ensureParentDirectoryExists(fsPath);
			const webStream = new Response(data).body;
			const nodeStream = webStream ? Readable.fromWeb(webStream) : Readable.from([]);
			await pipelineAsync(nodeStream, createWriteStream(fsPath));
		});
	}

	async readSingle(path: string): Promise<StorageEndpointFileReadResult> {
		const fsPath = this.#toFilesystemPath(path);

		return await withNodeErrors(fsPath, async () => {
			const stats = await fs.stat(fsPath);
			const nodeStream = createReadStream(fsPath);
			const webStream = Readable.toWeb(nodeStream);
			const wrappedStream = wrapStreamErrors(webStream, (error) => convertNodeError(error, fsPath));
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

		const stats = await withNodeErrors(fsPath, () => fs.stat(fsPath));

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
		await withNodeErrors(fsPath, () => fs.unlink(fsPath));
	}

	async copy(source: string, destination: string): Promise<void> {
		const sourceFsPath = this.#toFilesystemPath(source);
		const destFsPath = this.#toFilesystemPath(destination);

		await withNodeErrors(sourceFsPath, async () => {
			await this.#ensureParentDirectoryExists(destFsPath);
			await fs.copyFile(sourceFsPath, destFsPath);
		});
	}

	async move(source: string, destination: string): Promise<void> {
		const sourceFsPath = this.#toFilesystemPath(source);
		const destFsPath = this.#toFilesystemPath(destination);

		await withNodeErrors(sourceFsPath, async () => {
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
		const fsPrefix = this.#toFilesystemPath(prefix);
		return await this.#hasAnyFile(fsPrefix);
	}

	async #hasAnyFile(fsPath: string): Promise<boolean> {
		let dir: fsSync.Dir | undefined;

		let entries = 0;
		try {
			dir = await fs.opendir(fsPath);
			for await (const dirent of dir) {
				++entries;
				if (dirent.isFile()) {
					return true;
				}
				if (dirent.isDirectory()) {
					const subPath = join(fsPath, dirent.name);
					if (await this.#hasAnyFile(subPath)) {
						return true;
					}
				}
			}
			return false;
		} catch (error) {
			const storageError = convertNodeError(error, fsPath);
			if (storageError instanceof NotFoundError) {
				if (entries > 0) {
					// If we successfully got the first entry, but later got a
					// ENOENT, it's either a bug in our code or the directory
					// was deleted while we were iterating, either way throw the
					// node error not NotFoundError
					throw error;
				}
				return false;
			}
			throw storageError;
		} finally {
			await dir?.close();
		}
	}

	async *listEntries(prefix: string): AsyncGenerator<string, void> {
		yield* this.#streamDirectory({
			relativePath: "",
			fsPath: this.#toFilesystemPath(prefix),
			filesOnly: false,
			recursive: false,
		});
	}

	async *listFilesRecursive(prefix: string): AsyncGenerator<string, void> {
		yield* this.#streamDirectory({
			relativePath: "",
			fsPath: this.#toFilesystemPath(prefix),
			filesOnly: true,
			recursive: true,
		});
	}

	async deleteAllUnderPrefix(prefix: string): Promise<void> {
		const fsPrefix = this.#toFilesystemPath(prefix);

		await withNodeErrors(fsPrefix, async () => {
			// Use fs.rm with recursive option to remove directory and all contents
			// force: true means it won't throw if the directory doesn't exist
			await fs.rm(fsPrefix, { recursive: true, force: true });
		});
	}

	async *#streamDirectory(options: {
		relativePath: string;
		fsPath: string;
		filesOnly: boolean;
		recursive: boolean;
	}): AsyncGenerator<string, void> {
		const { relativePath, fsPath, filesOnly, recursive } = options;

		const entries: string[] = [];

		let dir: fsSync.Dir | undefined;

		try {
			dir = await fs.opendir(fsPath);
			for await (const dirent of dir) {
				if (dirent.isDirectory()) {
					entries.push(`${dirent.name}/`);
				} else if (dirent.isFile()) {
					entries.push(dirent.name);
				}
			}
		} catch (error) {
			const storageError = convertNodeError(error, fsPath);
			if (storageError instanceof NotFoundError) {
				if (entries.length > 0) {
					// If we successfully got the first entry, but later got a
					// ENOENT, it's either a bug in our code or the directory
					// was deleted while we were iterating, either way throw the
					// node error not NotFoundError
					throw error;
				}
				return;
			}
			throw storageError;
		} finally {
			await dir?.close();
		}

		entries.sort();

		for (const entry of entries) {
			const isDirectory = entry.endsWith("/");
			const entryPath = relativePath ? `${relativePath}/${entry}` : entry;

			if (!(filesOnly && isDirectory)) {
				yield entryPath;
			}

			if (recursive && isDirectory) {
				const subFsPath = join(fsPath, entry.slice(0, -1));
				yield* this.#streamDirectory({
					relativePath: entryPath.slice(0, -1),
					fsPath: subFsPath,
					filesOnly,
					recursive,
				});
			}
		}
	}

	#toFilesystemPath(storagePath: string): string {
		return join(this.#rootPath, storagePath);
	}

	async #ensureParentDirectoryExists(path: string): Promise<void> {
		await fs.mkdir(dirname(path), { recursive: true });
	}

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
