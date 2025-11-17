import { injectFactory } from "../../../container/inject";
import type {
	ConfiguredStorageDriver,
	Storage,
	StorageEndpoint,
	StorageEndpointFileInfoResult,
	StorageEndpointFileReadResult,
	StorageEndpointWriteOptions,
} from "../../../contracts/Storage";
import { Storage as StorageKey } from "../../../contracts/Storage";
import { BaseClass } from "../../../utils";
import type { ScopedStorageConfig } from "./ScopedStorageConfig";

export class ScopedStorageEndpoint extends BaseClass implements StorageEndpoint {
	readonly #diskConfig: string | ConfiguredStorageDriver | StorageEndpoint;
	readonly #getStorage: () => Storage;
	#endpoint: StorageEndpoint | null = null;
	readonly #prefix: string;
	readonly name = "scoped" as const;

	constructor(
		{ prefix, disk }: ScopedStorageConfig,
		getStorage: () => Storage = injectFactory(StorageKey),
	) {
		super();
		this.#diskConfig = disk;
		this.#getStorage = getStorage;
		if (!prefix.endsWith("/")) {
			prefix = `${prefix}/`;
		}
		if (!prefix.startsWith("/")) {
			prefix = `/${prefix}`;
		}
		this.#prefix = prefix;
	}

	#getEndpoint(): StorageEndpoint {
		if (this.#endpoint) {
			return this.#endpoint;
		}

		const config = this.#diskConfig;

		// If it's a string or driver, resolve it via Storage
		if (typeof config === "string" || "getEndpoint" in config) {
			const storage = this.#getStorage();
			const disk = typeof config === "string" ? storage.disk(config) : storage.build(config);
			this.#endpoint = disk.getEndpoint();
		} else {
			this.#endpoint = config;
		}

		return this.#endpoint;
	}

	get supportsMimeTypes(): boolean {
		return this.#getEndpoint().supportsMimeTypes;
	}

	get invalidNameChars(): string {
		return this.#getEndpoint().invalidNameChars;
	}

	async writeSingle(options: StorageEndpointWriteOptions): Promise<void> {
		await this.#getEndpoint().writeSingle({
			...options,
			path: this.#addPrefix(options.path),
		});
	}

	async readSingle(path: string): Promise<StorageEndpointFileReadResult> {
		return await this.#getEndpoint().readSingle(this.#addPrefix(path));
	}

	async getInfoSingle(path: string): Promise<StorageEndpointFileInfoResult> {
		return await this.#getEndpoint().getInfoSingle(this.#addPrefix(path));
	}

	async getPublicDownloadUrl(path: string, downloadFileName?: string): Promise<string> {
		return await this.#getEndpoint().getPublicDownloadUrl(this.#addPrefix(path), downloadFileName);
	}

	async getSignedDownloadUrl(
		path: string,
		expires: Date,
		downloadFileName?: string,
	): Promise<string> {
		return await this.#getEndpoint().getSignedDownloadUrl(
			this.#addPrefix(path),
			expires,
			downloadFileName,
		);
	}

	async getTemporaryUploadUrl(path: string, expires: Date): Promise<string> {
		return await this.#getEndpoint().getTemporaryUploadUrl(this.#addPrefix(path), expires);
	}

	async copy(source: string, destination: string): Promise<void> {
		await this.#getEndpoint().copy(this.#addPrefix(source), this.#addPrefix(destination));
	}

	async move(source: string, destination: string): Promise<void> {
		await this.#getEndpoint().move(this.#addPrefix(source), this.#addPrefix(destination));
	}

	async existsSingle(path: string): Promise<boolean> {
		return await this.#getEndpoint().existsSingle(this.#addPrefix(path));
	}

	async existsAnyUnderPrefix(prefix: string): Promise<boolean> {
		return await this.#getEndpoint().existsAnyUnderPrefix(this.#addPrefix(prefix));
	}

	async *listEntries(prefix: string): AsyncGenerator<string, void> {
		yield* this.#getEndpoint().listEntries(this.#addPrefix(prefix));
	}

	async *listFilesRecursive(prefix: string): AsyncGenerator<string, void> {
		yield* this.#getEndpoint().listFilesRecursive(this.#addPrefix(prefix));
	}

	async deleteSingle(path: string): Promise<void> {
		await this.#getEndpoint().deleteSingle(this.#addPrefix(path));
	}

	async deleteAllUnderPrefix(prefix: string): Promise<void> {
		await this.#getEndpoint().deleteAllUnderPrefix(this.#addPrefix(prefix));
	}

	#addPrefix(path: string): string {
		return this.#prefix + path.slice(1);
	}
}
