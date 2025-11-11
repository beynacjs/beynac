import type {
	StorageDirectoryOperations,
	StorageDisk,
	StorageEndpoint,
} from "../contracts/Storage";
import { DelegatesToDirectory } from "./DelegatesToDirectory";
import { StorageDirectoryImpl } from "./StorageDirectoryImpl";

/**
 * Implementation of the StorageDisk interface
 */
export class StorageDiskImpl extends DelegatesToDirectory implements StorageDisk {
	readonly name: string;
	readonly #rootDirectory: StorageDirectoryImpl;
	readonly #endpoint: StorageEndpoint;

	constructor(name: string, endpoint: StorageEndpoint) {
		super();
		this.name = name;
		this.#endpoint = endpoint;
		this.#rootDirectory = new StorageDirectoryImpl(this, endpoint, "/");
	}

	protected override getDirectoryForDelegation(): StorageDirectoryOperations {
		return this.#rootDirectory;
	}

	protected override getToStringExtra(): string | undefined {
		return this.#endpoint.name + "://" + this.name;
	}
}
