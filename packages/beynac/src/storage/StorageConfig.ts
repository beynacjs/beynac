import type { StorageEndpoint } from "../contracts/Storage";

/**
 * Configuration for the Storage manager
 *
 * @example
 * const storage = new StorageImpl({
 *   disks: {
 *     local: localFilesystem({ root: '/var/storage' }),
 *     temp: memoryStorage({}),
 *   },
 *   defaultDisk: 'local'
 * });
 */
export interface StorageConfig {
	disks?: Record<string, StorageEndpoint>;

	/**
	 * The default disk is returned from Storage.disk() and used when performing
	 * directory operations directly on the storage facade, e.g. Storage.allFiles()
	 *
	 * If no default disk is specified, the the 'local' disk will be used
	 *
	 * @default 'local'
	 */
	defaultDisk?: string | undefined;
}
