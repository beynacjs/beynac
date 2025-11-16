import { inject } from "../container/inject";
import { Configuration } from "../contracts/Configuration";
import type { Dispatcher } from "../contracts/Dispatcher";
import { Dispatcher as DispatcherKey } from "../contracts/Dispatcher";
import type {
	ConfiguredStorageDriver,
	Storage,
	StorageDirectoryOperations,
	StorageDisk,
	StorageEndpoint,
} from "../contracts/Storage";
import { onResetAllMocks } from "../testing/mocks";
import { DelegatesToDirectory } from "./DelegatesToDirectory";
import { MemoryStorageEndpoint } from "./drivers/memory/MemoryStorageEndpoint";
import { StorageDiskImpl } from "./StorageDiskImpl";
import { StorageEndpointBuilder } from "./StorageEndpointBuilder";
import { DiskNotFoundError } from "./storage-errors";

type StorageConfig = Pick<Configuration, "disks" | "defaultDisk">;

let anonDiskId = 0;

export class StorageImpl extends DelegatesToDirectory implements Storage {
	#disks: Map<string, StorageDisk> = new Map();
	#defaultDiskName: string;
	#originalEndpoints: Map<string, StorageEndpoint> = new Map();
	#dispatcher: Dispatcher;
	#diskBuilder: StorageEndpointBuilder;

	constructor(
		config: StorageConfig = inject(Configuration),
		dispatcher: Dispatcher = inject(DispatcherKey),
		diskBuilder: StorageEndpointBuilder = inject(StorageEndpointBuilder),
	) {
		super();
		this.#dispatcher = dispatcher;
		this.#diskBuilder = diskBuilder;
		for (const [name, driverOrEndpoint] of Object.entries(config.disks ?? {})) {
			const endpoint = this.#diskBuilder.build(driverOrEndpoint);
			this.#originalEndpoints.set(name, endpoint);
			this.#register(name, endpoint);
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

	build(driverOrEndpoint: ConfiguredStorageDriver | StorageEndpoint, name?: string): StorageDisk {
		const endpoint = this.#diskBuilder.build(driverOrEndpoint);
		return new StorageDiskImpl(name ?? `anonymous${++anonDiskId}`, endpoint, this.#dispatcher);
	}

	mock(diskName: string, endpoint?: StorageEndpoint): void {
		// Replace the disk with provided endpoint or a default memory driver
		const mockEndpoint = endpoint ?? new MemoryStorageEndpoint({});
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
