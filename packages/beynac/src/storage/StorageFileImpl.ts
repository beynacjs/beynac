import type {
	DownloadUrlOptions,
	StorageDisk,
	StorageEndpoint,
	StorageFile,
	StorageFileInfo,
	StoragePutPayload,
	StoragePutResponse,
	UploadUrlOptions,
} from "../contracts/Storage";
import { parseDurationAsFutureDate } from "../helpers/duration";
import { createFileName, mimeTypeFromFileName } from "./helpers/file-names";
import { getNameFromFile, getNameFromRequest } from "./helpers/MetadataExtractor";

/**
 * Implementation of the StorageFile interface
 */
export class StorageFileImpl implements StorageFile {
	readonly type = "file" as const;
	readonly disk: StorageDisk;
	readonly path: string;
	readonly #endpoint: StorageEndpoint;

	constructor(disk: StorageDisk, endpoint: StorageEndpoint, path: string) {
		this.disk = disk;
		this.#endpoint = endpoint;
		// Ensure path doesn't end with slash
		this.path = path.endsWith("/") ? path.slice(0, -1) : path;
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
		return await this.#endpoint.getInfoSingle(this.path);
	}

	async url(options?: DownloadUrlOptions | undefined): Promise<string> {
		// Default expiry to far future if not provided
		const expires = options?.expires
			? parseDurationAsFutureDate(options.expires)
			: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000); // 100 years

		return await this.#endpoint.getTemporaryDownloadUrl(this.path, expires, options?.downloadAs);
	}

	async put(payload: StoragePutPayload | File | Request): Promise<StoragePutResponse> {
		// Extract metadata from payload
		let data: StoragePutPayload["data"];
		let mimeType: string;
		let suggestedName: string | undefined;

		if (payload instanceof File) {
			data = payload;
			mimeType = payload.type || "application/octet-stream";
			suggestedName = getNameFromFile(payload);
		} else if (payload instanceof Request) {
			data = payload.body as StoragePutPayload["data"];
			mimeType = payload.headers.get("Content-Type") || "application/octet-stream";
			suggestedName = getNameFromRequest(payload);
		} else {
			data = payload.data;
			mimeType = payload.mimeType;
			suggestedName = payload.suggestedName;
		}

		// Create the invalid character regex from the endpoint's invalidFilenameChars
		const invalidChars = this.#endpoint.invalidFilenameChars;
		const invalidCharRegex =
			invalidChars.length > 0 ? new RegExp(`[${invalidChars}]`, "g") : /(?!)/;

		// Create a valid filename
		const actualName = createFileName(
			suggestedName,
			mimeType,
			this.#endpoint.supportsMimeTypes,
			invalidCharRegex,
		);

		// Determine the actual path
		// If this.path ends with /, it's a directory - use actualName as the file name
		// Otherwise, this.path is the full path to use
		const actualPath = this.path.endsWith("/") ? `${this.path}${actualName}` : this.path;

		// Write the file
		await this.#endpoint.writeSingle({
			path: actualPath,
			data,
			mimeType,
			suggestedName: actualName,
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

		// Get the file name from this file's path
		const fileName = this.path.split("/").pop() || this.path;

		return await destination.put({
			data: response.body as StoragePutPayload["data"],
			mimeType: info.mimeType,
			suggestedName: fileName,
		});
	}

	async uploadUrl(options?: UploadUrlOptions | undefined): Promise<string> {
		// Default expiry to far future if not provided
		const expires = options?.expires
			? parseDurationAsFutureDate(options.expires)
			: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000); // 100 years

		return await this.#endpoint.getTemporaryUploadUrl(this.path, expires);
	}
}
