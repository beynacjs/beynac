import type { ConfiguredStorageDriver } from "../../../contracts/Storage";
import { S3Endpoint } from "./S3Endpoint";
import type { S3StorageConfig } from "./S3StorageConfig";

/**
 * Create an S3-compatible storage driver configuration.
 *
 * @example
 * // AWS S3
 * const driver = s3Storage({
 *   endpoint: "https://s3.us-east-1.amazonaws.com",
 *   accessKey: process.env.AWS_ACCESS_KEY_ID!,
 *   secretKey: process.env.AWS_SECRET_ACCESS_KEY!,
 *   bucket: "my-app-uploads",
 * });
 *
 * @example
 * // MinIO
 * const driver = s3Storage({
 *   endpoint: "http://localhost:9000",
 *   accessKey: "minioadmin",
 *   secretKey: "minioadmin",
 *   bucket: "test-bucket",
 *   bucketUrlStyle: "path",
 * });
 */
export function s3Storage(config: S3StorageConfig): ConfiguredStorageDriver {
	return {
		build() {
			return new S3Endpoint(config);
		},
	};
}
