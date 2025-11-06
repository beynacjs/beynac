import type {
	Storage,
	StorageDirectory,
	StorageDisk,
	StorageEndpoint,
	StorageFile,
} from "../contracts/Storage";
import { MemoryDriver } from "./drivers/memory/MemoryDriver";
import type { StorageConfig } from "./StorageConfig";
import { StorageDiskImpl } from "./StorageDiskImpl";

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

	#register(name: string, endpoint: StorageEndpoint): void {
		const disk = new StorageDiskImpl(name, endpoint);
		this.#disks.set(name, disk);
	}

	disk(name?: string | undefined): StorageDisk {
		const diskName = name ?? this.#defaultDiskName;
		const disk = this.#disks.get(diskName);

		if (!disk) {
			throw new Error(`Disk "${diskName}" not found`);
		}

		return disk;
	}

	build(endpoint: StorageEndpoint): StorageDisk {
		// Generate a unique name for the one-off disk
		const name = `__built_${Date.now()}_${Math.random().toString(36).slice(2)}`;
		return new StorageDiskImpl(name, endpoint);
	}

	mock(diskName: string): void {
		// Replace the disk with a memory driver
		const memoryEndpoint = new MemoryDriver({});
		this.#register(diskName, memoryEndpoint);
	}

	// StorageDirectoryOperations delegation to default disk

	async exists(): Promise<boolean> {
		return await this.disk().exists();
	}

	async files(): Promise<StorageFile[]> {
		return await this.disk().files();
	}

	async allFiles(): Promise<StorageFile[]> {
		return await this.disk().allFiles();
	}

	async directories(): Promise<StorageDirectory[]> {
		return await this.disk().directories();
	}

	async allDirectories(): Promise<StorageDirectory[]> {
		return await this.disk().allDirectories();
	}

	async deleteAll(): Promise<void> {
		return await this.disk().deleteAll();
	}

	directory(path: string): StorageDirectory {
		return this.disk().directory(path);
	}

	file(path: string): StorageFile {
		return this.disk().file(path);
	}
}
