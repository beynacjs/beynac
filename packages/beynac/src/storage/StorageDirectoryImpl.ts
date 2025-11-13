import { join } from "node:path";
import type { Dispatcher } from "../contracts/Dispatcher";
import type {
	StorageDirectory,
	StorageDisk,
	StorageEndpoint,
	StorageFile,
	StorageFilePutPayload,
} from "../contracts/Storage";
import { parseAttributeHeader } from "../helpers/headers";
import { asyncGeneratorToArray, BaseClass } from "../utils";
import { createFileName, sanitiseName } from "./file-names";
import { StorageFileImpl } from "./StorageFileImpl";
import { InvalidPathError } from "./storage-errors";
import {
	DirectoryDeletedEvent,
	DirectoryDeletingEvent,
	DirectoryExistenceCheckedEvent,
	DirectoryExistenceCheckingEvent,
	DirectoryListedEvent,
	DirectoryListingEvent,
} from "./storage-events";
import { storageOperation } from "./storage-operation";

/**
 * Implementation of the StorageDirectory interface
 */
export class StorageDirectoryImpl extends BaseClass implements StorageDirectory {
	readonly type = "directory" as const;
	readonly disk: StorageDisk;
	readonly path: string;
	readonly #endpoint: StorageEndpoint;
	readonly #dispatcher: Dispatcher;

	constructor(disk: StorageDisk, endpoint: StorageEndpoint, path: string, dispatcher: Dispatcher) {
		super();
		this.disk = disk;
		this.#endpoint = endpoint;
		this.#dispatcher = dispatcher;
		if (!path.startsWith("/") || !path.endsWith("/")) {
			throw new InvalidPathError(path, "directory paths must start and end with a slash");
		}
		this.path = path;
	}

	async exists(): Promise<boolean> {
		return await storageOperation(
			"directory:existence-check",
			() => this.#endpoint.existsAnyUnderPrefix(this.path),
			() => new DirectoryExistenceCheckingEvent(this.disk, this.path),
			(start, exists) => new DirectoryExistenceCheckedEvent(start, exists),
			this.#dispatcher,
		);
	}

	async list(): Promise<Array<StorageFile | StorageDirectory>> {
		return asyncGeneratorToArray(this.listStreaming());
	}

	listStreaming(): AsyncGenerator<StorageFile | StorageDirectory, void> {
		return storageOperation(
			"directory:list",
			this.#listStreamingGenerator.bind(this),
			() => new DirectoryListingEvent(this.disk, this.path, "all", false),
			(start, count) => new DirectoryListedEvent(start, count),
			this.#dispatcher,
		);
	}

	async *#listStreamingGenerator(): AsyncGenerator<StorageFile | StorageDirectory, void> {
		for await (const path of this.#endpoint.listEntries(this.path)) {
			yield this.#createEntry(path);
		}
	}

	#createEntry(relativePath: string): StorageFile | StorageDirectory {
		// Convert relative path to absolute path
		const absolutePath = `${this.path}${relativePath}`;
		if (relativePath.endsWith("/")) {
			return new StorageDirectoryImpl(this.disk, this.#endpoint, absolutePath, this.#dispatcher);
		}
		return new StorageFileImpl(this.disk, this.#endpoint, absolutePath, this.#dispatcher);
	}

	async files(options?: { recursive?: boolean }): Promise<Array<StorageFile>> {
		return asyncGeneratorToArray(this.filesStreaming(options));
	}

	filesStreaming(options?: { recursive?: boolean }): AsyncGenerator<StorageFile, void> {
		const recursive = options?.recursive ?? false;
		return storageOperation(
			"directory:list",
			this.#filesStreamingGenerator.bind(this, recursive),
			() => new DirectoryListingEvent(this.disk, this.path, "files", recursive),
			(start, count) => new DirectoryListedEvent(start, count),
			this.#dispatcher,
		);
	}

	async *#filesStreamingGenerator(recursive: boolean): AsyncGenerator<StorageFile, void> {
		if (recursive) {
			// Use recursive listing
			for await (const path of this.#endpoint.listFilesRecursive(this.path)) {
				const entry = this.#createEntry(path);
				if (entry instanceof StorageFileImpl) {
					yield entry;
				}
			}
		} else {
			// Use immediate listing, filter to files only
			for await (const path of this.#endpoint.listEntries(this.path)) {
				const entry = this.#createEntry(path);
				if (entry instanceof StorageFileImpl) {
					yield entry;
				}
			}
		}
	}

	async directories(): Promise<Array<StorageDirectory>> {
		return asyncGeneratorToArray(this.directoriesStreaming());
	}

	directoriesStreaming(): AsyncGenerator<StorageDirectory, void> {
		return storageOperation(
			"directory:list",
			this.#directoriesStreamingGenerator.bind(this),
			() => new DirectoryListingEvent(this.disk, this.path, "directories", false),
			(start, count) => new DirectoryListedEvent(start, count),
			this.#dispatcher,
		);
	}

	async *#directoriesStreamingGenerator(): AsyncGenerator<StorageDirectory, void> {
		for await (const path of this.#endpoint.listEntries(this.path)) {
			const entry = this.#createEntry(path);
			if (entry instanceof StorageDirectoryImpl) {
				yield entry;
			}
		}
	}

	async deleteAll(): Promise<void> {
		await storageOperation(
			"directory:delete",
			() => this.#endpoint.deleteAllUnderPrefix(this.path),
			() => new DirectoryDeletingEvent(this.disk, this.path),
			(start) => new DirectoryDeletedEvent(start),
			this.#dispatcher,
		);
	}

	directory(path: string, options?: { onInvalid?: "convert" | "throw" }): StorageDirectory {
		const parts = this.#splitAndSanitisePath(path, options?.onInvalid);
		if (parts.length === 0) {
			return this;
		}
		const cleanPath = parts.join("/");
		let fullPath = join(this.path, cleanPath);
		if (!fullPath.endsWith("/")) {
			fullPath += "/";
		}
		return new StorageDirectoryImpl(this.disk, this.#endpoint, fullPath, this.#dispatcher);
	}

	file(path: string, options?: { onInvalid?: "convert" | "throw" }): StorageFile {
		const parts = this.#splitAndSanitisePath(path, options?.onInvalid);
		if (parts.length === 0) {
			throw new InvalidPathError(path, "file name cannot be empty");
		}
		const cleanPath = parts.join("/");
		return new StorageFileImpl(
			this.disk,
			this.#endpoint,
			join(this.path, cleanPath),
			this.#dispatcher,
		);
	}

	#splitAndSanitisePath(path: string, onInvalid: "convert" | "throw" = "convert"): string[] {
		const segments = path
			.replaceAll(/^\/+|\/$/g, "")
			.split(/\/+/g)
			.filter(Boolean);

		return segments.map((segment) => {
			const sanitisedName = sanitiseName(segment, this.#endpoint.invalidNameChars);
			if (onInvalid === "throw" && sanitisedName !== segment) {
				const fullPath = join(this.path, path);
				throw InvalidPathError.forInvalidCharacters(fullPath, this.#endpoint);
			}
			return sanitisedName;
		});
	}

	async putFile(
		payload: (StorageFilePutPayload & { suggestedName?: string | undefined }) | File | Request,
	): Promise<StorageFile> {
		// Extract metadata from payload
		let data: StorageFilePutPayload["data"] | null | undefined;
		let mimeType: string | null | undefined;
		let suggestedName: string | null | undefined;

		if (payload instanceof File) {
			data = payload;
			mimeType = payload.type || "application/octet-stream";
			suggestedName = payload.name?.trim();
		} else if (payload instanceof Request) {
			data = payload.body;
			mimeType = payload.headers.get("Content-Type");

			suggestedName = payload.headers.get("X-File-Name")?.trim();
			if (!suggestedName) {
				const contentDisposition = payload.headers.get("Content-Disposition");
				if (contentDisposition) {
					try {
						suggestedName = parseAttributeHeader(contentDisposition).attributes.filename;
					} catch {}
				}
			}
		} else {
			data = payload.data;
			mimeType = payload.mimeType;
			suggestedName = payload.suggestedName;
		}

		mimeType ??= "application/octet-stream";

		const file = this.file(
			sanitiseName(
				createFileName(suggestedName, mimeType, this.#endpoint.supportsMimeTypes),
				this.#endpoint.invalidNameChars,
			),
		);

		if (data != null) {
			await file.put({
				data,
				mimeType,
			});
		}

		return file;
	}

	protected override getToStringExtra(): string | undefined {
		return `${this.#endpoint.name}:/${this.path}`;
	}
}
