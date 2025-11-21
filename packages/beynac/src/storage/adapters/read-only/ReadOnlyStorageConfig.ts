import type { StorageAdapter, StorageDisk, StorageEndpoint } from "../../contracts/Storage";

/***/
export interface ReadOnlyStorageConfig {
	disk: string | StorageAdapter | StorageEndpoint | StorageDisk;
}
