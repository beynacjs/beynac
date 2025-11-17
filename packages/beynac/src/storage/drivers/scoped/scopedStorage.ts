import type { ConfiguredStorageDriver } from "../../../contracts/Storage";
import type { ScopedStorageConfig } from "./ScopedStorageConfig";
import { ScopedStorageEndpoint } from "./ScopedStorageEndpoint";

/**
 * Scoped storage driver that wraps an existing disk and automatically applies
 * a path prefix to all operations.
 *
 * This is useful for isolating file operations to a specific directory within
 * a larger storage system without having to manually include the prefix in
 * every operation.
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
 *     local: filesystemStorage({ rootPath: '/var/storage' }),
 *     images: scopedStorage({
 *       disk: 'local',
 *       prefix: '/videos/'
 *     })
 *   }
 * }
 */
export function scopedStorage(config: ScopedStorageConfig): ConfiguredStorageDriver {
	return {
		build(container) {
			return container.construct(ScopedStorageEndpoint, config);
		},
	};
}
