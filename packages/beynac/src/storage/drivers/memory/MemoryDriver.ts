import type {
	StorageEndpoint,
	StorageEndpointWriteOptions,
	StorageFileInfo,
} from "../../../contracts/Storage";

/**
 * Configuration for the memory driver
 */
export interface MemoryDriverConfig {
	/**
	 * Pre-populate the driver with initial files. Useful for test fixtures.
	 *
	 * @example
	 * initialFiles: {
	 *   'users/avatar.png': { data: avatarBytes, mimeType: 'image/png' },
	 *   'readme.txt': { data: 'Hello world', mimeType: 'text/plain' }
	 * }
	 */
	initialFiles?: Record<string, { data: string | Uint8Array; mimeType: string }> | undefined;

	/**
	 * Whether this driver supports MIME types natively.
	 * If false, MIME types will be inferred from file extensions.
	 * Default: true
	 */
	supportsMimeTypes?: boolean | undefined;

	/**
	 * A string containing characters that are invalid in filenames.
	 * Files will have these characters replaced with underscores.
	 * Default: "" (no invalid characters)
	 *
	 * @example
	 * invalidFilenameChars: '<>:"/\\|?*' // Windows-style restrictions
	 */
	invalidFilenameChars?: string | undefined;
}

interface MemoryFile {
	data: Uint8Array;
	mimeType: string;
	etag: string;
}

/**
 * In-memory storage driver for testing and temporary storage
 */
export class MemoryDriver implements StorageEndpoint {
	readonly #files: Map<string, MemoryFile> = new Map();

	readonly supportsMimeTypes: boolean;
	readonly invalidFilenameChars: string;

	constructor(config: MemoryDriverConfig) {
		this.supportsMimeTypes = config.supportsMimeTypes ?? true;
		this.invalidFilenameChars = config.invalidFilenameChars ?? "";

		// Pre-populate with initial files if provided
		if (config.initialFiles) {
			for (const [path, fileData] of Object.entries(config.initialFiles)) {
				this.writeSingle({
					data: fileData.data,
					mimeType: fileData.mimeType,
					suggestedName: path,
				});
				// Convert data to Uint8Array
				const data =
					typeof fileData.data === "string"
						? new TextEncoder().encode(fileData.data)
						: fileData.data;

				// TODO: Use proper hash function for ETag when hash helpers are available
				const etag = `"${data.length}-${Date.now()}"`;

				this.#files.set(path, {
					data,
					mimeType: fileData.mimeType,
					etag,
				});
			}
		}
	}

	async readSingle(path: string): Promise<Response> {
		const file = this.#files.get(path);
		if (!file) {
			return new Response(null, { status: 404, statusText: "Not Found" });
		}

		return new Response(file.data, {
			status: 200,
			headers: {
				"Content-Type": file.mimeType,
				"Content-Length": file.data.length.toString(),
				ETag: file.etag,
			},
		});
	}

	async writeSingle(options: StorageEndpointWriteOptions): Promise<void> {
		// Convert data to Uint8Array
		let data: Uint8Array;

		if (typeof options.data === "string") {
			data = new TextEncoder().encode(options.data);
		} else if (options.data instanceof Blob) {
			const buffer = await options.data.arrayBuffer();
			data = new Uint8Array(buffer);
		} else if (options.data instanceof ArrayBuffer) {
			data = new Uint8Array(options.data);
		} else if (ArrayBuffer.isView(options.data)) {
			data = new Uint8Array(options.data.buffer, options.data.byteOffset, options.data.byteLength);
		} else if (options.data instanceof ReadableStream) {
			// Read the stream
			const reader = options.data.getReader();
			const chunks: Uint8Array[] = [];
			// biome-ignore lint/suspicious/noAssignInExpressions: standard stream reading pattern
			for (let result; !(result = await reader.read()).done; ) {
				if (result.value instanceof Uint8Array) {
					chunks.push(result.value);
				}
			}
			// Combine chunks
			const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
			data = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of chunks) {
				data.set(chunk, offset);
				offset += chunk.length;
			}
		} else {
			throw new Error(`Unsupported data type: ${typeof options.data}`);
		}

		// TODO: Use proper hash function for ETag when hash helpers are available
		const etag = `"${data.length}-${Date.now()}"`;

		this.#files.set(options.path, {
			data,
			mimeType: options.mimeType,
			etag,
		});
	}

	async getInfoSingle(path: string): Promise<StorageFileInfo | null> {
		const file = this.#files.get(path);
		if (!file) {
			return null;
		}

		return {
			size: file.data.length,
			mimeType: file.mimeType,
			etag: file.etag,
		};
	}

	async getTemporaryDownloadUrl(
		path: string,
		_expires: Date,
		downloadFileName?: string | undefined,
	): Promise<string> {
		// Return fake URL for memory driver
		const params = downloadFileName ? `?download=${encodeURIComponent(downloadFileName)}` : "";
		return `memory://${path}${params}`;
	}

	async getTemporaryUploadUrl(path: string, _expires: Date): Promise<string> {
		// Return fake URL for memory driver
		return `memory://${path}?upload=true`;
	}

	async copy(source: string, destination: string): Promise<void> {
		const file = this.#files.get(source);
		if (!file) {
			throw new Error(`Source file not found: ${source}`);
		}

		// Create a copy of the file
		this.#files.set(destination, {
			data: file.data,
			mimeType: file.mimeType,
			etag: file.etag,
		});
	}

	async move(source: string, destination: string): Promise<void> {
		const file = this.#files.get(source);
		if (!file) {
			throw new Error(`Source file not found: ${source}`);
		}

		this.#files.set(destination, file);
		this.#files.delete(source);
	}

	async existsSingle(path: string): Promise<boolean> {
		return this.#files.has(path);
	}

	async existsAnyUnderPrefix(prefix: string): Promise<boolean> {
		for (const path of this.#files.keys()) {
			if (path.startsWith(prefix)) {
				return true;
			}
		}
		return false;
	}

	async listFiles(prefix: string, recursive: boolean): Promise<string[]> {
		const files: string[] = [];

		for (const path of this.#files.keys()) {
			if (!path.startsWith(prefix)) {
				continue;
			}

			const relativePath = path.slice(prefix.length);

			if (recursive) {
				// Include all files under the prefix
				files.push(path);
			} else {
				// Only include files directly in this directory (no slashes in relative path)
				if (!relativePath.includes("/")) {
					files.push(path);
				}
			}
		}

		return files.sort();
	}

	async listDirectories(prefix: string, recursive: boolean): Promise<string[]> {
		const directories = new Set<string>();

		for (const path of this.#files.keys()) {
			if (!path.startsWith(prefix)) {
				continue;
			}

			const relativePath = path.slice(prefix.length);
			const parts = relativePath.split("/").filter((p) => p !== "");

			if (parts.length === 0) {
				continue;
			}

			if (recursive) {
				// Add all parent directories
				let currentPath = prefix;
				for (let i = 0; i < parts.length - 1; i++) {
					currentPath += `${parts[i]}/`;
					directories.add(currentPath);
				}
			} else {
				// Only add immediate child directories
				if (parts.length > 1) {
					directories.add(`${prefix}${parts[0]}/`);
				}
			}
		}

		return Array.from(directories).sort();
	}

	async deleteSingle(path: string): Promise<void> {
		this.#files.delete(path);
	}

	async deleteAllUnderPrefix(prefix: string): Promise<void> {
		const toDelete: string[] = [];

		for (const path of this.#files.keys()) {
			if (path.startsWith(prefix)) {
				toDelete.push(path);
			}
		}

		for (const path of toDelete) {
			this.#files.delete(path);
		}
	}
}

/**
 * Create a memory-backed storage endpoint
 *
 * @example
 * const storage = new StorageImpl({
 *   disks: {
 *     temp: memoryDriver({})
 *   }
 * });
 */
export function memoryDriver(config: MemoryDriverConfig = {}): StorageEndpoint {
	return new MemoryDriver(config);
}
