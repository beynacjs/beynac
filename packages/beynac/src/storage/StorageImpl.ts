import type {
	Storage,
	StorageDirectoryOperations,
	StorageDisk,
	StorageEndpoint,
} from "../contracts/Storage";
import { DelegatesToDirectory } from "./DelegatesToDirectory";
import { MemoryStorageDriver } from "./drivers/memory/MemoryStorageDriver";
import type { StorageConfig } from "./StorageConfig";
import { StorageDiskImpl } from "./StorageDiskImpl";

let anonDiskId = 0;

export class StorageImpl extends DelegatesToDirectory implements Storage {
	#disks: Map<string, StorageDisk> = new Map();
	#defaultDiskName: string;
	#originalEndpoints: Map<string, StorageEndpoint> = new Map();

	constructor(config: StorageConfig = {}) {
		super();
		for (const [name, diskConfig] of Object.entries(config.disks ?? {})) {
			this.#originalEndpoints.set(name, diskConfig);
			this.#register(name, diskConfig);
		}

		this.#defaultDiskName = config.defaultDisk ?? "local";
	}

	#register(name: string, endpoint: StorageEndpoint): void {
		const disk = new StorageDiskImpl(name, endpoint);
		this.#disks.set(name, disk);
	}

	disk(name?: string): StorageDisk {
		if (name == null) {
			if (!this.#defaultDiskName) {
				throw new Error(
					"disk() normally returns the default disk, but no default disk is configured",
				);
			}
			name = this.#defaultDiskName;
		}
		const disk = this.#disks.get(name);

		if (!disk) {
			throw new Error(`Disk "${name}" not found`);
		}

		return disk;
	}

	build(endpoint: StorageEndpoint, name?: string): StorageDisk {
		return new StorageDiskImpl(name ?? `anonymous${++anonDiskId}`, endpoint);
	}

	mock(diskName: string): void {
		// Replace the disk with a memory driver
		const memoryEndpoint = new MemoryStorageDriver({});
		this.#register(diskName, memoryEndpoint);
	}

	resetMocks(): void {
		for (const [name, endpoint] of this.#originalEndpoints) {
			this.#register(name, endpoint);
		}
	}

	protected override getDirectoryForDelegation(): StorageDirectoryOperations {
		return this.disk();
	}
}
