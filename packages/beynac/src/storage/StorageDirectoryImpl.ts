import type {
	StorageDirectory,
	StorageDisk,
	StorageEndpoint,
	StorageFile,
} from "../contracts/Storage";

/**
 * Implementation of the StorageDirectory interface
 */
export class StorageDirectoryImpl implements StorageDirectory {
	readonly type = "directory" as const;
	readonly disk: StorageDisk;
	readonly path: string;
	// @ts-expect-error - Will be used in future implementation
	readonly #endpoint: StorageEndpoint;

	constructor(disk: StorageDisk, endpoint: StorageEndpoint, path: string) {
		this.disk = disk;
		this.#endpoint = endpoint;
		// Ensure path ends with slash
		this.path = path.endsWith("/") ? path : `${path}/`;
	}

	// StorageDirectoryOperations

	exists(): Promise<boolean> {
		throw new Error("Not implemented");
	}

	files(): Promise<StorageFile[]> {
		throw new Error("Not implemented");
	}

	allFiles(): Promise<StorageFile[]> {
		throw new Error("Not implemented");
	}

	directories(): Promise<StorageDirectory[]> {
		throw new Error("Not implemented");
	}

	allDirectories(): Promise<StorageDirectory[]> {
		throw new Error("Not implemented");
	}

	deleteAll(): Promise<void> {
		throw new Error("Not implemented");
	}

	directory(_path: string): StorageDirectory {
		throw new Error("Not implemented");
	}

	file(_path: string): StorageFile {
		throw new Error("Not implemented");
	}
}
