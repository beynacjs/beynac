import type {
	DownloadUrlOptions,
	StorageDisk,
	StorageEndpoint,
	StorageFile,
	StorageFileInfo,
	StorageFilePutPayload,
	StoragePutResponse,
	UploadUrlOptions,
} from "../contracts/Storage";
import { durationStringToDate } from "../helpers/time";
import { BaseClass } from "../utils";
import { mimeTypeFromFileName } from "./file-names";

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
		if (path !== "" && !path.startsWith("/")) {
			throw new Error(`Paths must start with a slash: ${path}`);
		}
	}

	async delete(): Promise<void> {
		await this.#endpoint.deleteSingle(this.path);
	}

	async exists(): Promise<boolean> {
		return await this.#endpoint.existsSingle(this.path);
	}

	async fetch(): Promise<Response> {
		const response = await this.#endpoint.readSingle(this.path);

		if (!response.ok) {
			throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
		}

		// If the endpoint doesn't support MIME types, infer from file extension
		if (!this.#endpoint.supportsMimeTypes) {
			const inferredMimeType = mimeTypeFromFileName(this.path);
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: {
					...Object.fromEntries(response.headers.entries()),
					"Content-Type": inferredMimeType,
				},
			});
		}

		return response;
	}

	async info(): Promise<StorageFileInfo | null> {
		const endpointInfo = await this.#endpoint.getInfoSingle(this.path);
		if (!endpointInfo) return null;
		return {
			etag: endpointInfo.etag,
			size: endpointInfo.contentLength,
			mimeType: endpointInfo.mimeType ?? "application/octet-stream",
		};
	}

	async url(options?: DownloadUrlOptions): Promise<string> {
		return await this.#endpoint.getSignedDownloadUrl(
			this.path,
			durationStringToDate(options?.expires ?? "100y"),
			options?.downloadAs,
		);
	}

	async put(payload: StorageFilePutPayload | File | Request): Promise<StoragePutResponse> {
		// Extract metadata from payload
		let data: StorageFilePutPayload["data"];
		let mimeType: string;

		if (payload instanceof File) {
			data = payload;
			mimeType = payload.type || "application/octet-stream";
		} else if (payload instanceof Request) {
			data = payload.body as StorageFilePutPayload["data"];
			mimeType = payload.headers.get("Content-Type") || "application/octet-stream";
		} else {
			data = payload.data;
			mimeType = payload.mimeType;
		}

		// Use the file's existing path
		const actualPath = this.path;

		// Extract the filename from the path
		const actualName = actualPath.split("/").pop() || actualPath;

		// Write the file
		await this.#endpoint.writeSingle({
			path: actualPath,
			data,
			mimeType,
		});

		return {
			actualName,
			actualPath,
		};
	}

	async copyTo(destination: StorageFile): Promise<StoragePutResponse> {
		// Check if same disk
		if (destination.disk === this.disk) {
			// Use endpoint copy for efficiency
			await this.#endpoint.copy(this.path, destination.path);

			// Extract the name from the destination path
			const actualName = destination.path.split("/").pop() || destination.path;

			return {
				actualName,
				actualPath: destination.path,
			};
		}

		// Different disk - fetch and put
		const response = await this.fetch();
		const info = await this.info();

		if (!info) {
			throw new Error(`Source file not found: ${this.path}`);
		}

		// Don't pass suggestedName - destination.path is already the full path
		return await destination.put({
			data: response.body as StorageFilePutPayload["data"],
			mimeType: info.mimeType,
		});
	}

	async uploadUrl(options?: UploadUrlOptions): Promise<string> {
		return await this.#endpoint.getTemporaryUploadUrl(
			this.path,
			durationStringToDate(options?.expires ?? "100y"),
		);
	}

	protected override getToStringExtra(): string | undefined {
		return `${this.#endpoint.name}:/${this.path}`;
	}
}
