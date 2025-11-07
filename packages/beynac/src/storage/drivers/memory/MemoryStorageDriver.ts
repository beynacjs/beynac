import type {
	StorageEndpoint,
	StorageEndpointFileInfo,
	StorageEndpointWriteOptions,
} from "../../../contracts/Storage";
import { describeType } from "../../../utils";

type SynchronousBinaryContent = string | ArrayBuffer | ArrayBufferView;

/**
 * Configuration for the memory driver
 */
export interface MemoryStorageDriverConfig {
	/**
	 * Pre-populate the driver with initial files. Useful for test fixtures.
	 *
	 * @example
	 * initialFiles: {
	 *   'readme.txt': { data: 'Hello world', mimeType: 'text/plain' }
	 *   'users/avatar.png': { data: avatarBytes },
	 * }
	 */
	initialFiles?:
		| Record<
				string,
				{
					data: SynchronousBinaryContent | null | undefined;
					mimeType?: string | undefined;
				}
		  >
		| undefined;

	/**
	 * Whether this driver supports MIME types natively.
	 */
	supportsMimeTypes?: boolean | undefined;

	/**
	 * A string containing characters that are invalid in filenames.
	 * Files will have these characters replaced with underscores.
	 * Default: "" (no invalid characters)
	 *
	 * @example
	 * invalidNameChars: '<>:"/\\|?*' // Windows-style restrictions
	 */
	invalidNameChars?: string | undefined;

	/**
	 * Name of this endpoint for identification purposes.
	 * Default: "memory"
	 */
	name?: string | undefined;
}

interface MemoryFile {
	data: Uint8Array;
	mimeType: string | undefined;
	etag: string;
}

/**
 * In-memory storage driver for testing and temporary storage
 */
export class MemoryStorageDriver implements StorageEndpoint {
	readonly #files: Map<string, MemoryFile> = new Map();

	readonly name: string;
	readonly supportsMimeTypes: boolean;
	readonly invalidNameChars: string;

	constructor(config: MemoryStorageDriverConfig) {
		this.name = config.name ?? "memory";
		this.supportsMimeTypes = config.supportsMimeTypes ?? true;
		this.invalidNameChars = config.invalidNameChars ?? "";

		// Pre-populate with initial files if provided
		if (config.initialFiles) {
			for (const [path, fileData] of Object.entries(config.initialFiles)) {
				if (fileData.data != null) {
					this.#writeSingleSync(
						path.startsWith("/") ? path : `/${path}`,
						fileData.data,
						fileData.mimeType,
					);
				}
			}
		}
	}

	async writeSingle({ data, path, mimeType }: StorageEndpointWriteOptions): Promise<void> {
		const response = new Response(
			// cast required for bun's incomplete BodyInit types, this is valid according to web standard Response
			data as ArrayBuffer,
		);
		const serialised = await response.arrayBuffer();
		this.#writeSingleSync(path, serialised, mimeType);
	}

	#writeSingleSync(
		path: string,
		data: SynchronousBinaryContent,
		mimeType: string | undefined,
	): void {
		validatePath(path);
		const binaryData = serialize(data);

		// TODO: Use proper hash function for ETag when hash helpers are available
		const etag = `${binaryData.length}`;

		this.#files.set(path, {
			data: binaryData,
			mimeType: mimeType,
			etag,
		});
	}

	async readSingle(path: string): Promise<Response> {
		validatePath(path);
		const file = this.#files.get(path);
		if (!file) {
			return new Response(null, { status: 404, statusText: "Not Found" });
		}

		return new Response(file.data, {
			status: 200,
			headers: {
				"Content-Type": file.mimeType ?? "application/octet-stream",
				"Content-Length": file.data.length.toString(),
				ETag: file.etag,
			},
		});
	}

	async getInfoSingle(path: string): Promise<StorageEndpointFileInfo | null> {
		validatePath(path);
		const file = this.#files.get(path);
		if (!file) {
			return null;
		}

		return {
			contentLength: file.data.length,
			mimeType: file.mimeType ?? "application/octet-stream",
			etag: file.etag,
		};
	}

	async getSignedDownloadUrl(
		path: string,
		_expires: Date,
		downloadFileName?: string,
	): Promise<string> {
		validatePath(path);
		// Return fake URL for memory driver
		const params = downloadFileName ? `?download=${encodeURIComponent(downloadFileName)}` : "";
		return `memory://${path}${params}`;
	}

	async getTemporaryUploadUrl(path: string, _expires: Date): Promise<string> {
		validatePath(path);
		// Return fake URL for memory driver
		return `memory://${path}?upload=true`;
	}

	async copy(source: string, destination: string): Promise<void> {
		validatePath(source);
		validatePath(destination);
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
		validatePath(source);
		validatePath(destination);
		const file = this.#files.get(source);
		if (!file) {
			throw new Error(`Source file not found: ${source}`);
		}

		this.#files.set(destination, file);
		this.#files.delete(source);
	}

	async existsSingle(path: string): Promise<boolean> {
		validatePath(path);
		return this.#files.has(path);
	}

	async existsAnyUnderPrefix(prefix: string): Promise<boolean> {
		validatePath(prefix);
		for (const path of this.#files.keys()) {
			if (path.startsWith(prefix)) {
				return true;
			}
		}
		return false;
	}

	async listFiles(prefix: string, recursive: boolean): Promise<string[]> {
		validatePath(prefix);
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
		validatePath(prefix);
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
		validatePath(path);
		this.#files.delete(path);
	}

	async deleteAllUnderPrefix(prefix: string): Promise<void> {
		validatePath(prefix);
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
 *     temp: memoryStorage({})
 *   }
 * });
 */
export function memoryStorage(config: MemoryStorageDriverConfig = {}): StorageEndpoint {
	return new MemoryStorageDriver(config);
}

const validatePath = (path: string): void => {
	if (!path.startsWith("/")) {
		throw new Error(`Paths must start with a slash: ${path}`);
	}
};

const serialize = (data: SynchronousBinaryContent): Uint8Array => {
	if (typeof data === "string") {
		return new TextEncoder().encode(data);
	}

	if (data instanceof ArrayBuffer) {
		return new Uint8Array(data);
	}

	if (data instanceof URLSearchParams) {
		return new TextEncoder().encode(data.toString());
	}

	throw new Error(`Unsupported data type: ${describeType(data)}`);
};
