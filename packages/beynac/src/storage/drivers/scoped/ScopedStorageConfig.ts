import type {
	ConfiguredStorageDriver,
	StorageDisk,
	StorageEndpoint,
} from "../../../contracts/Storage";

export interface ScopedStorageConfig {
	/**
	 * The backing disk to wrap, see
	 */
	disk: string | ConfiguredStorageDriver | StorageEndpoint | StorageDisk;

	/**
	 * The path prefix to apply to all operations, e.g. "/videos/"
	 */
	prefix: string;
}
