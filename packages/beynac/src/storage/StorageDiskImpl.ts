import type {
	StorageDirectory,
	StorageDisk,
	StorageEndpoint,
	StorageFile,
} from "../contracts/Storage";

/**
 * Implementation of the StorageDisk interface
 */
export class StorageDiskImpl implements StorageDisk {
	readonly name: string;
	// @ts-expect-error - Will be used in future implementation
	readonly #endpoint: StorageEndpoint;

	constructor(name: string, endpoint: StorageEndpoint) {
		this.name = name;
		this.#endpoint = endpoint;
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
