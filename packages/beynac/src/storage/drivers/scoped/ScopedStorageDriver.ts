import type {
	StorageEndpoint,
	StorageEndpointFileInfoResult,
	StorageEndpointFileReadResult,
	StorageEndpointWriteOptions,
} from "../../../contracts/Storage";
import { BaseClass } from "../../../utils";

export interface ScopedStorageDriverConfig {
	/**
	 * The backing disk to wrap. All operations will be performed on this disk
	 * with the prefix automatically applied.
	 */
	disk: StorageEndpoint;

	/**
	 * The path prefix to apply to all operations, e.g. "/videos/"
	 */
	prefix: string;
}

export class ScopedStorageDriver extends BaseClass implements StorageEndpoint {
	readonly #disk: StorageEndpoint;
	readonly #prefix: string;
	readonly name = "scoped" as const;

	constructor({ prefix, disk }: ScopedStorageDriverConfig) {
		super();
		this.#disk = disk;
		if (!prefix.endsWith("/")) {
			prefix = `${prefix}/`;
		}
		if (!prefix.startsWith("/")) {
			prefix = `/${prefix}`;
		}
		this.#prefix = prefix;
	}

	get supportsMimeTypes(): boolean {
		return this.#disk.supportsMimeTypes;
	}

	get invalidNameChars(): string {
		return this.#disk.invalidNameChars;
	}

	async writeSingle(options: StorageEndpointWriteOptions): Promise<void> {
		await this.#disk.writeSingle({
			...options,
			path: this.#addPrefix(options.path),
		});
	}

	async readSingle(path: string): Promise<StorageEndpointFileReadResult> {
		return await this.#disk.readSingle(this.#addPrefix(path));
	}

	async getInfoSingle(path: string): Promise<StorageEndpointFileInfoResult> {
		return await this.#disk.getInfoSingle(this.#addPrefix(path));
	}

	async getPublicDownloadUrl(path: string, downloadFileName?: string): Promise<string> {
		return await this.#disk.getPublicDownloadUrl(this.#addPrefix(path), downloadFileName);
	}

	async getSignedDownloadUrl(
		path: string,
		expires: Date,
		downloadFileName?: string,
	): Promise<string> {
		return await this.#disk.getSignedDownloadUrl(this.#addPrefix(path), expires, downloadFileName);
	}

	async getTemporaryUploadUrl(path: string, expires: Date): Promise<string> {
		return await this.#disk.getTemporaryUploadUrl(this.#addPrefix(path), expires);
	}

	async copy(source: string, destination: string): Promise<void> {
		await this.#disk.copy(this.#addPrefix(source), this.#addPrefix(destination));
	}

	async move(source: string, destination: string): Promise<void> {
		await this.#disk.move(this.#addPrefix(source), this.#addPrefix(destination));
	}

	async existsSingle(path: string): Promise<boolean> {
		return await this.#disk.existsSingle(this.#addPrefix(path));
	}

	async existsAnyUnderPrefix(prefix: string): Promise<boolean> {
		return await this.#disk.existsAnyUnderPrefix(this.#addPrefix(prefix));
	}

	async *listEntries(prefix: string): AsyncGenerator<string, void> {
		yield* this.#disk.listEntries(this.#addPrefix(prefix));
	}

	async *listFilesRecursive(prefix: string): AsyncGenerator<string, void> {
		yield* this.#disk.listFilesRecursive(this.#addPrefix(prefix));
	}

	async deleteSingle(path: string): Promise<void> {
		await this.#disk.deleteSingle(this.#addPrefix(path));
	}

	async deleteAllUnderPrefix(prefix: string): Promise<void> {
		await this.#disk.deleteAllUnderPrefix(this.#addPrefix(prefix));
	}

	#addPrefix(path: string): string {
		return this.#prefix + path.slice(1);
	}
}

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
export function scopedStorage(config: ScopedStorageDriverConfig): StorageEndpoint {
	return new ScopedStorageDriver(config);
}
