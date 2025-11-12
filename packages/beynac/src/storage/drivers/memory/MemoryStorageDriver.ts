import type {
	StorageEndpoint,
	StorageEndpointFileInfo,
	StorageEndpointWriteOptions,
} from "../../../contracts/Storage";
import * as hash from "../../../helpers/hash";
import { BaseClass, describeType, withoutUndefinedValues } from "../../../utils";
import { NotFoundError } from "../../storage-errors";

type SynchronousBinaryContent = string | ArrayBuffer | ArrayBufferView;

/**
 * Configuration for the memory driver
 */
export interface MemoryStorageDriverConfig {
	/**
	 * Pre-populate the driver with initial files. Useful for test fixtures.
	 *
	 * Values can be:
	 * - A string (mimeType defaults to "text/plain")
	 * - An object with data and optional mimeType
	 *
	 * @example
	 * initialFiles: {
	 *   'readme.txt': 'Hello world',
	 *   'users/avatar.png': { data: avatarBytes },
	 * }
	 */
	initialFiles?:
		| Record<
				string,
				| string
				| {
						data: SynchronousBinaryContent | null | undefined;
						mimeType?: string | null | undefined;
				  }
		  >
		| undefined;

	/**
	 * Whether this driver supports MIME types - if not then the system infer
	 * them from file extensions
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
	mimeType: string | null;
	etag: string;
}

/**
 * In-memory storage driver for testing and temporary storage
 */
export class MemoryStorageDriver extends BaseClass implements StorageEndpoint {
	readonly #files: Map<string, MemoryFile> = new Map();

	readonly name: string;
	readonly supportsMimeTypes: boolean;
	readonly invalidNameChars: string;

	constructor(config: MemoryStorageDriverConfig) {
		super();
		this.name = config.name ?? "memory";
		const supportsMimeTypes = config.supportsMimeTypes ?? true;
		this.supportsMimeTypes = supportsMimeTypes;
		this.invalidNameChars = config.invalidNameChars ?? "";

		if (config.initialFiles) {
			for (const [path, fileData] of Object.entries(config.initialFiles)) {
				const normalisedPath = path.startsWith("/") ? path : `/${path}`;
				if (typeof fileData === "string") {
					this.#writeSingleSync(normalisedPath, fileData, supportsMimeTypes ? "text/plain" : null);
				} else if (fileData.data != null) {
					this.#writeSingleSync(
						normalisedPath,
						fileData.data,
						supportsMimeTypes ? fileData.mimeType : null,
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
		mimeType: string | null | undefined,
	): void {
		validatePath(path);
		const binaryData = serialize(data);

		const etag = hash.sha256(binaryData);

		this.#files.set(path, {
			data: binaryData,
			mimeType: mimeType ?? null,
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
			headers: withoutUndefinedValues({
				"Content-Type": file.mimeType ?? undefined,
				"Content-Length": file.data.length.toString(),
				ETag: file.etag,
			}),
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

	async getPublicDownloadUrl(path: string, downloadFileName?: string): Promise<string> {
		return fakeUrl(path, { download: downloadFileName });
	}

	async getSignedDownloadUrl(
		path: string,
		expires: Date,
		downloadFileName?: string,
	): Promise<string> {
		validatePath(path);
		return fakeUrl(path, {
			download: downloadFileName,
			expires,
		});
	}

	async getTemporaryUploadUrl(path: string, expires: Date): Promise<string> {
		validatePath(path);
		return fakeUrl(path, { upload: "true", expires });
	}

	async copy(source: string, destination: string): Promise<void> {
		validatePath(source);
		validatePath(destination);
		const file = this.#files.get(source);
		if (!file) {
			throw new NotFoundError(source);
		}

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
			throw new NotFoundError(source);
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

	async *listEntries(prefix: string): AsyncGenerator<string, void> {
		validatePath(prefix, true);

		const entries = new Set<string>();

		for (const path of this.#files.keys()) {
			if (!path.startsWith(prefix)) {
				continue;
			}

			const relativePath = path.slice(prefix.length);
			const slashIndex = relativePath.indexOf("/");

			if (slashIndex === -1) {
				entries.add(relativePath);
			} else {
				const firstSegment = relativePath.slice(0, slashIndex);
				entries.add(`${firstSegment}/`);
			}
		}

		for (const entry of Array.from(entries).sort()) {
			yield entry;
		}
	}

	async *listFilesRecursive(prefix: string): AsyncGenerator<string, void> {
		validatePath(prefix, true);

		const files = Array.from(this.#files.keys())
			.filter((path) => path.startsWith(prefix))
			.map((path) => path.slice(prefix.length))
			.sort();

		for (const file of files) {
			yield file;
		}
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
 * Create memory-backed storage
 */
export function memoryStorage(config: MemoryStorageDriverConfig = {}): StorageEndpoint {
	return new MemoryStorageDriver(config);
}

const validatePath = (path: string, endingSlash = false): void => {
	if (!path.startsWith("/")) {
		throw new Error(`Paths must start with a slash: ${path}`);
	}
	if (endingSlash && !path.endsWith("/")) {
		throw new Error(`Path prefixes must end with a slash: ${path}`);
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

const fakeUrl = (
	path: string,
	params: Record<string, string | number | undefined | Date>,
): string => {
	let query = "";
	for (let [key, value] of Object.entries(params)) {
		if (value === undefined) {
			continue;
		}
		if (value instanceof Date) {
			value = value.toISOString();
		}
		query += query ? "&" : "?";
		query += `${key}=${value}`;
	}
	return `memory://${path}${query}`;
};
