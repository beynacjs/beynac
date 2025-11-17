import type { ConfiguredStorageDriver, Storage, StorageEndpoint } from "../contracts/Storage";
import { BaseClass } from "../utils";

/**
 * Type guard to check if a value is a ConfiguredStorageDriver
 */
export function isConfiguredStorageDriver(value: unknown): value is ConfiguredStorageDriver {
	return typeof value === "object" && value !== null && "getEndpoint" in value;
}

export abstract class WrappedEndpoint extends BaseClass {
	readonly #diskConfig: string | ConfiguredStorageDriver | StorageEndpoint;
	readonly #getStorage: () => Storage;
	#endpoint: StorageEndpoint | null = null;

	constructor(
		diskConfig: string | ConfiguredStorageDriver | StorageEndpoint,
		getStorage: () => Storage,
	) {
		super();
		this.#diskConfig = diskConfig;
		this.#getStorage = getStorage;
	}

	protected get endpoint(): StorageEndpoint {
		if (this.#endpoint) {
			return this.#endpoint;
		}

		const config = this.#diskConfig;

		// If it's a string or driver, resolve it via Storage
		if (typeof config === "string" || isConfiguredStorageDriver(config)) {
			const storage = this.#getStorage();
			const disk = typeof config === "string" ? storage.disk(config) : storage.build(config);
			this.#endpoint = disk.getEndpoint();
		} else {
			this.#endpoint = config;
		}

		return this.#endpoint;
	}

	get supportsMimeTypes(): boolean {
		return this.endpoint.supportsMimeTypes;
	}

	get invalidNameChars(): string {
		return this.endpoint.invalidNameChars;
	}
}
