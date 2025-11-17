import type {
	ConfiguredStorageDriver,
	StorageDisk,
	StorageEndpoint,
} from "../../../contracts/Storage";

export interface ReadOnlyStorageConfig {
	disk: string | ConfiguredStorageDriver | StorageEndpoint | StorageDisk;
}
