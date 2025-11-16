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
		getEndpoint(container) {
			return container.construct(ScopedStorageEndpoint, config);
		},
	};
}
