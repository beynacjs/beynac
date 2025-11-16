import type { ConfiguredStorageDriver, StorageEndpoint } from "../../../contracts/Storage";

/**
 * Configuration for the scoped storage driver
 */
export interface ScopedStorageConfig {
	/**
	 * The backing disk to wrap. All operations will be performed on this disk
	 * with the prefix automatically applied.
	 *
	 * Can be:
	 * - A disk name (string) to look up an existing disk
	 * - A ConfiguredStorageDriver to build on-demand
	 * - A StorageEndpoint instance to use directly
	 */
	disk: string | ConfiguredStorageDriver | StorageEndpoint;

	/**
	 * The path prefix to apply to all operations, e.g. "/videos/"
	 */
	prefix: string;
}
