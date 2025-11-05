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

/**
 * Implementation of the StorageFile interface
 */
export class StorageFileImpl implements StorageFile {
	readonly type = "file" as const;
	readonly disk: StorageDisk;
	readonly path: string;
	// @ts-expect-error - Will be used in future implementation
	readonly #endpoint: StorageEndpoint;

	constructor(disk: StorageDisk, endpoint: StorageEndpoint, path: string) {
		this.disk = disk;
		this.#endpoint = endpoint;
		// Ensure path doesn't end with slash
		this.path = path.endsWith("/") ? path.slice(0, -1) : path;
	}

	delete(): Promise<void> {
		throw new Error("Not implemented");
	}

	exists(): Promise<boolean> {
		throw new Error("Not implemented");
	}

	fetch(): Promise<Response> {
		throw new Error("Not implemented");
	}

	info(): Promise<StorageFileInfo | null> {
		throw new Error("Not implemented");
	}

	url(_options?: DownloadUrlOptions | undefined): Promise<string> {
		throw new Error("Not implemented");
	}

	put(_payload: StoragePutPayload | File | Request): Promise<StoragePutResponse> {
		throw new Error("Not implemented");
	}

	copyTo(_destination: StorageFile): Promise<StoragePutResponse> {
		throw new Error("Not implemented");
	}

	uploadUrl(_options?: UploadUrlOptions | undefined): Promise<string> {
		throw new Error("Not implemented");
	}
}
