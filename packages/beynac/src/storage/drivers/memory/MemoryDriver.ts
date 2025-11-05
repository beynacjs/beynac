import type {
	StorageEndpoint,
	StorageEndpointWriteOptions,
	StorageFileInfo,
	StoragePutPayload,
	StoragePutResponse,
} from "../../../contracts/Storage";

/**
 * Configuration for the memory driver (currently none required)
 */
export interface MemoryDriverConfig {}

interface MemoryFile {
	data: Uint8Array;
	mimeType: string;
	etag: string;
}

/**
 * In-memory storage driver for testing and temporary storage
 */
export class MemoryDriver implements StorageEndpoint {
	// @ts-expect-error - Will be used in future implementation
	readonly #files: Map<string, MemoryFile> = new Map();

	// Memory driver supports MIME types natively
	readonly supportsMimeTypes = true;

	// No invalid filename characters for memory storage
	readonly invalidFilenameChars = "";

	constructor(_config: MemoryDriverConfig) {
		// Configuration can be used in the future if needed
	}

	readSingle(_path: string): Promise<Response> {
		throw new Error("Not implemented");
	}

	writeSingle(_options: StorageEndpointWriteOptions): Promise<void> {
		throw new Error("Not implemented");
	}

	getInfoSingle(_path: string): Promise<StorageFileInfo | null> {
		throw new Error("Not implemented");
	}

	getTemporaryDownloadUrl(
		_path: string,
		_expires: Date,
		_downloadFileName?: string | undefined,
	): Promise<string> {
		throw new Error("Not implemented");
	}

	getTemporaryUploadUrl(_path: string, _expires: Date): Promise<string> {
		throw new Error("Not implemented");
	}

	put(_payload: StoragePutPayload | File | Request): Promise<StoragePutResponse> {
		throw new Error("Not implemented");
	}

	copy(_source: string, _destination: string): Promise<void> {
		throw new Error("Not implemented");
	}

	move(_source: string, _destination: string): Promise<void> {
		throw new Error("Not implemented");
	}

	existsSingle(_path: string): Promise<boolean> {
		throw new Error("Not implemented");
	}

	existsAnyUnderPrefix(_prefix: string): Promise<boolean> {
		throw new Error("Not implemented");
	}

	listFiles(_prefix: string, _recursive: boolean): Promise<string[]> {
		throw new Error("Not implemented");
	}

	listDirectories(_prefix: string, _recursive: boolean): Promise<string[]> {
		throw new Error("Not implemented");
	}
}

/**
 * Create a memory-backed storage endpoint
 *
 * @example
 * const storage = new StorageImpl({
 *   disks: {
 *     temp: memoryDriver({})
 *   }
 * });
 */
export function memoryDriver(config: MemoryDriverConfig = {}): StorageEndpoint {
	return new MemoryDriver(config);
}
