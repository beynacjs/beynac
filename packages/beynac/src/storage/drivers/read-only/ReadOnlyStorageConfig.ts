import type { ConfiguredStorageDriver, StorageEndpoint } from "../../../contracts/Storage";

/**
 * Configuration for the read-only storage driver
 */
export interface ReadOnlyStorageConfig {
	/**
	 * The backing disk to wrap. All read operations will be delegated to this disk,
	 * while write operations will throw PermissionsError.
	 *
	 * Can be:
	 * - A disk name (string) to look up an existing disk
	 * - A ConfiguredStorageDriver to build on-demand
	 * - A StorageEndpoint instance to use directly
	 */
	disk: string | ConfiguredStorageDriver | StorageEndpoint;
}
