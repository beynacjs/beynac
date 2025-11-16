import type { ConfiguredStorageDriver } from "../../../contracts/Storage";
import type { FilesystemStorageConfig } from "./FilesystemStorageConfig";
import { FilesystemStorageEndpoint } from "./FilesystemStorageEndpoint";

/**
 * Create storage backed by the filesystem
 */
export function filesystemStorage(config: FilesystemStorageConfig): ConfiguredStorageDriver {
	return {
		getEndpoint(container) {
			return container.construct(FilesystemStorageEndpoint, config);
		},
	};
}
