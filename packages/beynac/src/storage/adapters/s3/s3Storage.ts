import type { StorageAdapter } from "../../contracts/Storage";
import { S3Endpoint } from "./S3Endpoint";
import type { S3StorageConfig } from "./S3StorageConfig";

/**
 * Create an S3-compatible storage adapter
 */
export function s3Storage(config: S3StorageConfig): StorageAdapter {
	return {
		build(container) {
			return container.construct(S3Endpoint, config);
		},
	};
}
