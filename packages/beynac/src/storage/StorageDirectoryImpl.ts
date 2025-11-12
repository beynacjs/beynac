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
import { BaseClass } from "../utils";
import { createFileName, sanitiseName } from "./file-names";
import { StorageFileImpl } from "./StorageFileImpl";
import { InvalidPathError } from "./storage-errors";
import {
	DirectoryDeletedEvent,
	DirectoryDeletingEvent,
	DirectoryDirectoriesListedEvent,
	DirectoryExistenceCheckedEvent,
	DirectoryExistenceCheckingEvent,
	DirectoryFilesListedEvent,
	DirectoryListingDirectoriesEvent,
	DirectoryListingFilesEvent,
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

	async files(): Promise<StorageFile[]> {
		return this.#files(false);
	}

	async allFiles(): Promise<StorageFile[]> {
		return this.#files(true);
	}

	async #files(all: boolean): Promise<StorageFile[]> {
		const filePaths = await storageOperation(
			"directory:files-list",
			() => this.#endpoint.listFiles(this.path, all),
			() => new DirectoryListingFilesEvent(this.disk, this.path, all),
			(start, paths) => {
				const files = paths.map(
					(filePath) => new StorageFileImpl(this.disk, this.#endpoint, filePath, this.#dispatcher),
				);
				return new DirectoryFilesListedEvent(start, files);
			},
			this.#dispatcher,
		);

		const files = filePaths.map(
			(filePath) => new StorageFileImpl(this.disk, this.#endpoint, filePath, this.#dispatcher),
		);

		return files;
	}

	async directories(): Promise<StorageDirectory[]> {
		return this.#directories(false);
	}

	async allDirectories(): Promise<StorageDirectory[]> {
		return this.#directories(true);
	}

	async #directories(all: boolean): Promise<StorageDirectory[]> {
		return await storageOperation(
			"directory:directories-list",
			async () => {
				const paths = await this.#endpoint.listDirectories(this.path, all);
				const directories = paths.map(
					(path) => new StorageDirectoryImpl(this.disk, this.#endpoint, path, this.#dispatcher),
				);
				return directories;
			},
			() => new DirectoryListingDirectoriesEvent(this.disk, this.path, all),
			(start, directories) => new DirectoryDirectoriesListedEvent(start, directories),
			this.#dispatcher,
		);
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
