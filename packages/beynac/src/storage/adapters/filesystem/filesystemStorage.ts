import type { StorageAdapter } from "../../../contracts/Storage";
import { FilesystemEndpoint } from "./FilesystemEndpoint";
import type { FilesystemStorageConfig } from "./FilesystemStorageConfig";

/**
 * Create storage backed by the filesystem
 */
export function filesystemStorage(config: FilesystemStorageConfig): StorageAdapter {
	return {
		build(container) {
			return container.construct(FilesystemEndpoint, config);
		},
	};
}
