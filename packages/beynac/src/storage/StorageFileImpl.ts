import type {
	StorageDisk,
	StorageEndpoint,
	StorageEndpointFileInfo,
	StorageFile,
	StorageFileInfo,
	StorageFilePutPayload,
	StorageFileSignedUrlOptions,
	StorageFileUploadUrlOptions,
	StorageFileUrlOptions,
} from "../contracts/Storage";
import { durationStringToDate } from "../helpers/time";
import { BaseClass } from "../utils";
import { mimeTypeFromFileName } from "./file-names";
import { InvalidPathError, NotFoundError, StorageHttpError } from "./storage-errors";
import { storageOperation } from "./storage-operation";

/**
 * Implementation of the StorageFile interface
 */
export class StorageFileImpl extends BaseClass implements StorageFile {
	readonly type = "file" as const;
	readonly path: string;
	readonly disk: StorageDisk;
	readonly #endpoint: StorageEndpoint;

	constructor(disk: StorageDisk, endpoint: StorageEndpoint, path: string) {
		super();
		this.disk = disk;
		this.path = path;
		this.#endpoint = endpoint;
		if (!path.startsWith("/")) {
			throw new InvalidPathError(path, "must start with a slash");
		}
	}

	async delete(): Promise<void> {
		await storageOperation("delete file", () => this.#endpoint.deleteSingle(this.path));
	}

	async exists(): Promise<boolean> {
		return await storageOperation("check file existence", () =>
			this.#endpoint.existsSingle(this.path),
		);
	}

	async fetch(): Promise<Response> {
		const response = await storageOperation("read file", async () => {
			const response = await this.#endpoint.readSingle(this.path);
			// Check and throw HttpError inside storageOperation so it gets caught and converted to correct error type
			if (!response.ok) {
				throw new StorageHttpError(this.path, response.status, response.statusText);
			}
			return response;
		});

		if (!response.headers.get("Content-Type") || !this.#endpoint.supportsMimeTypes) {
			const inferredMimeType = mimeTypeFromFileName(this.path);
			response.headers.set("Content-Type", inferredMimeType);
		}

		return response;
	}

	async info(): Promise<StorageFileInfo | null> {
		let endpointInfo: StorageEndpointFileInfo | null;
		try {
			endpointInfo = await storageOperation("retrieve file metadata", () =>
				this.#endpoint.getInfoSingle(this.path),
			);
		} catch (error) {
			if (error instanceof NotFoundError) {
				return null;
			}
			throw error;
		}

		if (!endpointInfo) return null;
		return {
			etag: endpointInfo.etag,
			size: endpointInfo.contentLength,
			mimeType: endpointInfo.mimeType ?? "application/octet-stream",
		};
	}

	async url(options?: StorageFileUrlOptions): Promise<string> {
		return await storageOperation("get file URL", () =>
			this.#endpoint.getSignedDownloadUrl(
				this.path,
				durationStringToDate("100y"),
				options?.downloadAs,
			),
		);
	}

	async signedUrl(options?: StorageFileSignedUrlOptions): Promise<string> {
		return await storageOperation("get signed URL", () =>
			this.#endpoint.getSignedDownloadUrl(
				this.path,
				durationStringToDate(options?.expires ?? "100y"),
				options?.downloadAs,
			),
		);
	}

	async uploadUrl(options?: StorageFileUploadUrlOptions): Promise<string> {
		return await storageOperation("get upload URL", () =>
			this.#endpoint.getTemporaryUploadUrl(
				this.path,
				durationStringToDate(options?.expires ?? "100y"),
			),
		);
	}

	async put(payload: StorageFilePutPayload | File | Request): Promise<void> {
		// Extract metadata from payload
		let data: StorageFilePutPayload["data"];
		let mimeType: string;

		if (payload instanceof File) {
			data = payload;
			mimeType = payload.type || "application/octet-stream";
		} else if (payload instanceof Request) {
			if (payload.body == null) {
				return;
			}
			data = payload.body;
			mimeType = payload.headers.get("Content-Type") || "application/octet-stream";
		} else {
			data = payload.data;
			mimeType = payload.mimeType;
		}

		await storageOperation("write file", () =>
			this.#endpoint.writeSingle({
				path: this.path,
				data,
				mimeType,
			}),
		);
	}

	async copyTo(destination: StorageFile): Promise<void> {
		if (destination.disk === this.disk) {
			await storageOperation("copy file", () => this.#endpoint.copy(this.path, destination.path));
			return;
		}

		const response = await this.fetch();
		const info = await this.info();

		if (!info) {
			throw new NotFoundError(this.path);
		}

		return await destination.put({
			data: response.body ?? new Uint8Array(),
			mimeType: info.mimeType,
		});
	}

	async moveTo(destination: StorageFile): Promise<void> {
		if (destination.disk === this.disk) {
			await storageOperation("move file", () => this.#endpoint.move(this.path, destination.path));
			return;
		}

		await this.copyTo(destination);
		await this.delete();
	}

	protected override getToStringExtra(): string | undefined {
		return `${this.#endpoint.name}:/${this.path}`;
	}
}
