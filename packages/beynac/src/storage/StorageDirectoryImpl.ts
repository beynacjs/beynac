import { join } from "node:path";
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

/**
 * Implementation of the StorageDirectory interface
 */
export class StorageDirectoryImpl extends BaseClass implements StorageDirectory {
	readonly type = "directory" as const;
	readonly disk: StorageDisk;
	readonly path: string;
	readonly #endpoint: StorageEndpoint;

	constructor(disk: StorageDisk, endpoint: StorageEndpoint, path: string) {
		super();
		this.disk = disk;
		this.#endpoint = endpoint;
		if (!path.startsWith("/")) {
			throw new Error(`Paths must start with a slash: ${path}`);
		}
		this.path = path.endsWith("/") ? path : `${path}/`;
	}

	async exists(): Promise<boolean> {
		return await this.#endpoint.existsAnyUnderPrefix(this.path);
	}

	async files(): Promise<StorageFile[]> {
		return this.#files(false);
	}

	async allFiles(): Promise<StorageFile[]> {
		return this.#files(true);
	}

	async #files(all: boolean): Promise<StorageFile[]> {
		const filePaths = await this.#endpoint.listFiles(this.path, all);
		return filePaths.map((filePath) => new StorageFileImpl(this.disk, this.#endpoint, filePath));
	}

	async directories(): Promise<StorageDirectory[]> {
		return this.#directories(false);
	}

	async allDirectories(): Promise<StorageDirectory[]> {
		return this.#directories(true);
	}

	async #directories(all: boolean): Promise<StorageDirectory[]> {
		const dirPaths = await this.#endpoint.listDirectories(this.path, all);
		return dirPaths.map((dirPath) => new StorageDirectoryImpl(this.disk, this.#endpoint, dirPath));
	}

	async deleteAll(): Promise<void> {
		await this.#endpoint.deleteAllUnderPrefix(this.path);
	}

	directory(path: string): StorageDirectory {
		const parts = this.#splitAndSanitisePath(path);
		if (parts.length === 0) {
			return this;
		}
		const cleanPath = parts.join("/") + "/";
		return new StorageDirectoryImpl(this.disk, this.#endpoint, join(this.path, cleanPath));
	}

	file(path: string): StorageFile {
		const parts = this.#splitAndSanitisePath(path);
		if (parts.length === 0) {
			throw new Error(`Invalid file name "${path}"`);
		}
		const cleanPath = parts.join("/");
		return new StorageFileImpl(this.disk, this.#endpoint, join(this.path, cleanPath));
	}

	#splitAndSanitisePath(path: string): string[] {
		return path
			.replaceAll(/^\/+|\/$/g, "")
			.split(/\/+/g)
			.filter(Boolean)
			.map((segment) => sanitiseName(segment, this.#endpoint.invalidNameChars));
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
