import type { StorageEndpoint } from "../contracts/Storage";

/**
 * Configuration for the Storage manager
 *
 * @example
 * const storage = new StorageImpl({
 *   disks: {
 *     local: localFilesystem({ root: '/var/storage' }),
 *     temp: memoryDriver({}),
 *   },
 *   defaultDisk: 'local'
 * });
 */
export interface StorageConfig {
	disks: Record<string, StorageEndpoint>;
	defaultDisk?: string | undefined;
}
