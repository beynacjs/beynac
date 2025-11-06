import type {
	StorageDirectory,
	StorageDisk,
	StorageEndpoint,
	StorageFile,
} from "../contracts/Storage";
import { StorageFileImpl } from "./StorageFileImpl";

/**
 * Implementation of the StorageDirectory interface
 */
export class StorageDirectoryImpl implements StorageDirectory {
	readonly type = "directory" as const;
	readonly disk: StorageDisk;
	readonly path: string;
	readonly #endpoint: StorageEndpoint;

	constructor(disk: StorageDisk, endpoint: StorageEndpoint, path: string) {
		this.disk = disk;
		this.#endpoint = endpoint;
		// Ensure path ends with slash (but keep empty path as empty)
		this.path = path === "" ? "" : path.endsWith("/") ? path : `${path}/`;
	}

	// StorageDirectoryOperations

	async exists(): Promise<boolean> {
		return await this.#endpoint.existsAnyUnderPrefix(this.path);
	}

	async files(): Promise<StorageFile[]> {
		const filePaths = await this.#endpoint.listFiles(this.path, false);
		return filePaths.map((filePath) => new StorageFileImpl(this.disk, this.#endpoint, filePath));
	}

	async allFiles(): Promise<StorageFile[]> {
		const filePaths = await this.#endpoint.listFiles(this.path, true);
		return filePaths.map((filePath) => new StorageFileImpl(this.disk, this.#endpoint, filePath));
	}

	async directories(): Promise<StorageDirectory[]> {
		const dirPaths = await this.#endpoint.listDirectories(this.path, false);
		return dirPaths.map((dirPath) => new StorageDirectoryImpl(this.disk, this.#endpoint, dirPath));
	}

	async allDirectories(): Promise<StorageDirectory[]> {
		const dirPaths = await this.#endpoint.listDirectories(this.path, true);
		return dirPaths.map((dirPath) => new StorageDirectoryImpl(this.disk, this.#endpoint, dirPath));
	}

	async deleteAll(): Promise<void> {
		await this.#endpoint.deleteAllUnderPrefix(this.path);
	}

	directory(path: string): StorageDirectory {
		// Remove leading slash if present
		const cleanPath = path.startsWith("/") ? path.slice(1) : path;
		// Join paths
		const fullPath = `${this.path}${cleanPath}`;
		return new StorageDirectoryImpl(this.disk, this.#endpoint, fullPath);
	}

	file(path: string): StorageFile {
		// Remove leading slash if present
		const cleanPath = path.startsWith("/") ? path.slice(1) : path;
		// Join paths
		const fullPath = `${this.path}${cleanPath}`;
		return new StorageFileImpl(this.disk, this.#endpoint, fullPath);
	}
}
