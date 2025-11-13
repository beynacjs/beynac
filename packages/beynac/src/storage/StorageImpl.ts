import { inject } from "../container/inject";
import { Configuration } from "../contracts/Configuration";
import type { Dispatcher } from "../contracts/Dispatcher";
import { Dispatcher as DispatcherKey } from "../contracts/Dispatcher";
import type {
	Storage,
	StorageDirectoryOperations,
	StorageDisk,
	StorageEndpoint,
} from "../contracts/Storage";
import { onResetAllMocks } from "../testing/mocks";
import { DelegatesToDirectory } from "./DelegatesToDirectory";
import { MemoryStorageDriver } from "./drivers/memory/MemoryStorageDriver";
import { StorageDiskImpl } from "./StorageDiskImpl";
import { DiskNotFoundError } from "./storage-errors";

type StorageConfig = Pick<Configuration, "disks" | "defaultDisk">;

let anonDiskId = 0;

export class StorageImpl extends DelegatesToDirectory implements Storage {
	#disks: Map<string, StorageDisk> = new Map();
	#defaultDiskName: string;
	#originalEndpoints: Map<string, StorageEndpoint> = new Map();
	#dispatcher: Dispatcher;

	constructor(
		config: StorageConfig = inject(Configuration),
		dispatcher: Dispatcher = inject(DispatcherKey),
	) {
		super();
		this.#dispatcher = dispatcher;
		for (const [name, diskConfig] of Object.entries(config.disks ?? {})) {
			this.#originalEndpoints.set(name, diskConfig);
			this.#register(name, diskConfig);
		}

		this.#defaultDiskName = config.defaultDisk ?? "local";
	}

	#register(name: string, endpoint: StorageEndpoint): void {
		const disk = new StorageDiskImpl(name, endpoint, this.#dispatcher);
		this.#disks.set(name, disk);
	}

	disk(name?: string): StorageDisk {
		if (name == null) {
			name = this.#defaultDiskName;
		}
		const disk = this.#disks.get(name);

		if (!disk) {
			throw new DiskNotFoundError(name);
		}

		return disk;
	}

	build(endpoint: StorageEndpoint, name?: string): StorageDisk {
		return new StorageDiskImpl(name ?? `anonymous${++anonDiskId}`, endpoint, this.#dispatcher);
	}

	mock(diskName: string, endpoint?: StorageEndpoint): void {
		// Replace the disk with provided endpoint or a default memory driver
		const mockEndpoint = endpoint ?? new MemoryStorageDriver({});
		this.#register(diskName, mockEndpoint);
		onResetAllMocks(() => this.resetMocks());
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
