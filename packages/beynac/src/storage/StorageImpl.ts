import type {
	Storage,
	StorageDirectory,
	StorageDisk,
	StorageEndpoint,
	StorageFile,
} from "../contracts/Storage";
import type { StorageConfig } from "./StorageConfig";

/**
 * Implementation of the Storage interface
 */
export class StorageImpl implements Storage {
	#disks: Map<string, StorageDisk> = new Map();
	#defaultDiskName: string;

	constructor(config: StorageConfig) {
		if (Object.keys(config.disks).length === 0) {
			throw new Error("At least one disk must be configured");
		}

		// Register all disks
		for (const [name, diskConfig] of Object.entries(config.disks)) {
			this.#register(name, diskConfig);
		}

		// Set default disk
		this.#defaultDiskName = config.defaultDisk ?? Object.keys(config.disks)[0]!;

		if (!this.#disks.has(this.#defaultDiskName)) {
			throw new Error(`Default disk "${this.#defaultDiskName}" not found`);
		}
	}

	#register(_name: string, _endpoint: StorageEndpoint): void {
		throw new Error("Not implemented");
	}

	disk(_name?: string | undefined): StorageDisk {
		throw new Error("Not implemented");
	}

	build(_endpoint: StorageEndpoint): StorageDisk {
		throw new Error("Not implemented");
	}

	mock(_diskName: string): void {
		throw new Error("Not implemented");
	}

	// StorageDirectoryOperations delegation to default disk

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
