import type {
	StorageDirectory,
	StorageDisk,
	StorageEndpoint,
	StorageFile,
} from "../contracts/Storage";
import { StorageDirectoryImpl } from "./StorageDirectoryImpl";

/**
 * Implementation of the StorageDisk interface
 */
export class StorageDiskImpl implements StorageDisk {
	readonly name: string;
	readonly #rootDirectory: StorageDirectoryImpl;

	constructor(name: string, endpoint: StorageEndpoint) {
		this.name = name;
		// Create a root directory at path ""
		this.#rootDirectory = new StorageDirectoryImpl(this, endpoint, "");
	}

	// StorageDirectoryOperations - delegate to root directory

	async exists(): Promise<boolean> {
		return await this.#rootDirectory.exists();
	}

	async files(): Promise<StorageFile[]> {
		return await this.#rootDirectory.files();
	}

	async allFiles(): Promise<StorageFile[]> {
		return await this.#rootDirectory.allFiles();
	}

	async directories(): Promise<StorageDirectory[]> {
		return await this.#rootDirectory.directories();
	}

	async allDirectories(): Promise<StorageDirectory[]> {
		return await this.#rootDirectory.allDirectories();
	}

	async deleteAll(): Promise<void> {
		return await this.#rootDirectory.deleteAll();
	}

	directory(path: string): StorageDirectory {
		return this.#rootDirectory.directory(path);
	}

	file(path: string): StorageFile {
		return this.#rootDirectory.file(path);
	}
}
