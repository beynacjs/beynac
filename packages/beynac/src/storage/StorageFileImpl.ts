import type { Dispatcher } from "../contracts/Dispatcher";
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
import {
	FileCopiedEvent,
	FileCopyingEvent,
	FileDeletedEvent,
	FileDeletingEvent,
	FileExistenceCheckedEvent,
	FileExistenceCheckingEvent,
	FileInfoRetrievedEvent,
	FileInfoRetrievingEvent,
	FileMovedEvent,
	FileMovingEvent,
	FileReadEvent,
	FileReadingEvent,
	FileUrlGeneratedEvent,
	FileUrlGeneratingEvent,
	FileWritingEvent,
	FileWrittenEvent,
} from "./storage-events";
import { storageOperation } from "./storage-operation";

/**
 * Implementation of the StorageFile interface
 */
export class StorageFileImpl extends BaseClass implements StorageFile {
	readonly type = "file" as const;
	readonly path: string;
	readonly disk: StorageDisk;
	readonly #endpoint: StorageEndpoint;
	readonly #dispatcher: Dispatcher;

	constructor(disk: StorageDisk, endpoint: StorageEndpoint, path: string, dispatcher: Dispatcher) {
		super();
		this.disk = disk;
		this.path = path;
		this.#endpoint = endpoint;
		this.#dispatcher = dispatcher;
		if (!path.startsWith("/")) {
			throw new InvalidPathError(path, "must start with a slash");
		}
	}

	async delete(): Promise<void> {
		await storageOperation(
			"file:delete",
			() => this.#endpoint.deleteSingle(this.path),
			() => new FileDeletingEvent(this.disk, this.path),
			(start) => new FileDeletedEvent(start),
			this.#dispatcher,
		);
	}

	async exists(): Promise<boolean> {
		return await storageOperation(
			"file:existence-check",
			() => this.#endpoint.existsSingle(this.path),
			() => new FileExistenceCheckingEvent(this.disk, this.path),
			(start, exists) => new FileExistenceCheckedEvent(start, exists),
			this.#dispatcher,
		);
	}

	async fetch(): Promise<Response> {
		const response = await storageOperation(
			"file:read",
			async () => {
				const response = await this.#endpoint.readSingle(this.path);
				// Check and throw HttpError inside storageOperation so it gets caught and converted to correct error type
				if (!response.ok) {
					throw new StorageHttpError(this.path, response.status, response.statusText);
				}
				return response;
			},
			() => new FileReadingEvent(this.disk, this.path),
			(start, response) => new FileReadEvent(start, response),
			this.#dispatcher,
		);

		if (!response.headers.get("Content-Type") || !this.#endpoint.supportsMimeTypes) {
			const inferredMimeType = mimeTypeFromFileName(this.path);
			response.headers.set("Content-Type", inferredMimeType);
		}

		return response;
	}

	async info(): Promise<StorageFileInfo | null> {
		let endpointInfo: StorageEndpointFileInfo | null;
		try {
			endpointInfo = await storageOperation(
				"file:info-retrieve",
				() => this.#endpoint.getInfoSingle(this.path),
				() => new FileInfoRetrievingEvent(this.disk, this.path),
				(start, result) => {
					if (!result) {
						return new FileInfoRetrievedEvent(start, null);
					}
					const info: StorageFileInfo = {
						etag: result.etag,
						size: result.contentLength,
						mimeType: result.mimeType ?? "application/octet-stream",
					};
					return new FileInfoRetrievedEvent(start, info);
				},
				this.#dispatcher,
			);
		} catch (error) {
			if (error instanceof NotFoundError) {
				return null;
			}
			throw error;
		}

		if (!endpointInfo) {
			return null;
		}

		const info: StorageFileInfo = {
			etag: endpointInfo.etag,
			size: endpointInfo.contentLength,
			mimeType: endpointInfo.mimeType ?? "application/octet-stream",
		};

		return info;
	}

	async url(options?: StorageFileUrlOptions): Promise<string> {
		const urlOptions: { expires?: string | Date; downloadAs?: string } = { expires: "100y" };
		if (options?.downloadAs) {
			urlOptions.downloadAs = options.downloadAs;
		}
		return await storageOperation(
			"file:url-generate",
			() =>
				this.#endpoint.getSignedDownloadUrl(
					this.path,
					durationStringToDate("100y"),
					options?.downloadAs,
				),
			() => new FileUrlGeneratingEvent(this.disk, this.path, "url", urlOptions),
			(start, url) => new FileUrlGeneratedEvent(start, url),
			this.#dispatcher,
		);
	}

	async signedUrl(options?: StorageFileSignedUrlOptions): Promise<string> {
		const urlOptions: { expires?: string | Date; downloadAs?: string } = {
			expires: options?.expires ?? "100y",
		};
		if (options?.downloadAs) {
			urlOptions.downloadAs = options.downloadAs;
		}
		return await storageOperation(
			"file:url-generate",
			() =>
				this.#endpoint.getSignedDownloadUrl(
					this.path,
					durationStringToDate(options?.expires ?? "100y"),
					options?.downloadAs,
				),
			() => new FileUrlGeneratingEvent(this.disk, this.path, "signed", urlOptions),
			(start, url) => new FileUrlGeneratedEvent(start, url),
			this.#dispatcher,
		);
	}

	async uploadUrl(options?: StorageFileUploadUrlOptions): Promise<string> {
		const urlOptions: { expires?: string | Date; downloadAs?: string } = {
			expires: options?.expires ?? "100y",
		};
		return await storageOperation(
			"file:url-generate",
			() =>
				this.#endpoint.getTemporaryUploadUrl(
					this.path,
					durationStringToDate(options?.expires ?? "100y"),
				),
			() => new FileUrlGeneratingEvent(this.disk, this.path, "upload", urlOptions),
			(start, url) => new FileUrlGeneratedEvent(start, url),
			this.#dispatcher,
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

		await storageOperation(
			"file:write",
			() =>
				this.#endpoint.writeSingle({
					path: this.path,
					data,
					mimeType,
				}),
			() => new FileWritingEvent(this.disk, this.path, data, mimeType),
			(start) => new FileWrittenEvent(start),
			this.#dispatcher,
		);
	}

	async copyTo(destination: StorageFile): Promise<void> {
		if (destination.disk === this.disk) {
			await storageOperation(
				"file:copy",
				() => this.#endpoint.copy(this.path, destination.path),
				() => new FileCopyingEvent(this.disk, this.path, destination.disk.name, destination.path),
				(start) => new FileCopiedEvent(start),
				this.#dispatcher,
			);
			return;
		}

		// For cross-disk copy, use underlying operations which will dispatch their own events
		const response = await this.fetch();

		await destination.put({
			data: response.body ?? new Uint8Array(),
			// TODO remove this ?? when we implement optional mimeType
			mimeType: response.headers.get("Content-Type") ?? "application/octet-stream",
		});
	}

	async moveTo(destination: StorageFile): Promise<void> {
		if (destination.disk === this.disk) {
			await storageOperation(
				"file:move",
				() => this.#endpoint.move(this.path, destination.path),
				() => new FileMovingEvent(this.disk, this.path, destination.disk.name, destination.path),
				(start) => new FileMovedEvent(start),
				this.#dispatcher,
			);
			return;
		}

		// For cross-disk move, use underlying operations which will dispatch their own events
		await this.copyTo(destination);
		await this.delete();
	}

	protected override getToStringExtra(): string | undefined {
		return `${this.#endpoint.name}:/${this.path}`;
	}
}
