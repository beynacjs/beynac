import type { StorageAdapter } from "../../contracts/Storage";
import { ReadOnlyEndpoint } from "./ReadOnlyEndpoint";
import type { ReadOnlyStorageConfig } from "./ReadOnlyStorageConfig";

/**
 * Read-only storage adapter that wraps an existing disk and prevents all write operations.
 *
 * Wrapped disks can be:
 * - A disk name (string) to wrap a configured, named disk
 * - A disk configuration (e.g. filesystemStorage(...))
 * - A StorageDisk instance as returned by storage.disk()
 * - A StorageEndpoint instance (the low-level interface implemented by storage adapters)
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
export function readOnlyStorage(config: ReadOnlyStorageConfig): StorageAdapter {
	return {
		build(container) {
			return container.construct(ReadOnlyEndpoint, config);
		},
	};
}
