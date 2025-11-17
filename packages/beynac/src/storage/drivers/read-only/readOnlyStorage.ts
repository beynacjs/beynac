import type { ConfiguredStorageDriver } from "../../../contracts/Storage";
import type { ReadOnlyStorageConfig } from "./ReadOnlyStorageConfig";
import { ReadOnlyStorageEndpoint } from "./ReadOnlyStorageEndpoint";

/**
 * Read-only storage driver that wraps an existing disk and prevents all write operations.
 *
 * @param config.disk - a string disk name or configuration (e.g. `filesystemStorage(...)`).
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
		getEndpoint(container) {
			return container.construct(ReadOnlyStorageEndpoint, config);
		},
	};
}
