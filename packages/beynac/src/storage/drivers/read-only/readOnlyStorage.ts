import type { ConfiguredStorageDriver } from "../../../contracts/Storage";
import type { ReadOnlyStorageConfig } from "./ReadOnlyStorageConfig";
import { ReadOnlyStorageEndpoint } from "./ReadOnlyStorageEndpoint";

/**
 * Read-only storage driver that wraps an existing disk and prevents all write operations.
 *
 * Wrapped disks can be:
 * - A disk name (string) to wrap a configured, named disk
 * - A disk configuration (e.g. filesystemStorage(...))
 * - A StorageDisk instance as returned by storage.disk()
 * - A StorageEndpoint instance (the low-level interface implemented by storage drivers)
 *
 * @example
 * {
 *   disks: {
 *     main: filesystemStorage({ rootPath: '/var/storage' }),
 *     readonly: readOnlyStorage({
 *       disk: 'main'
 *     })
 *   }
 * }
 */
export function readOnlyStorage(config: ReadOnlyStorageConfig): ConfiguredStorageDriver {
	return {
		build(container) {
			return container.construct(ReadOnlyStorageEndpoint, config);
		},
	};
}
