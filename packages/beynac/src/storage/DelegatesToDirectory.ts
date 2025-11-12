import type {
	StorageDirectory,
	StorageDirectoryOperations,
	StorageFile,
	StorageFilePutPayload,
} from "../contracts/Storage";
import { BaseClass } from "../utils";

/**
 * Implementation of the StorageDisk interface
 */
export abstract class DelegatesToDirectory extends BaseClass implements StorageDirectoryOperations {
	protected abstract getDirectoryForDelegation(): StorageDirectoryOperations;

	async exists(): Promise<boolean> {
		return await this.getDirectoryForDelegation().exists();
	}

	async list(): Promise<Array<StorageFile | StorageDirectory>> {
		return await this.getDirectoryForDelegation().list();
	}

	listStreaming(): AsyncGenerator<StorageFile | StorageDirectory, void> {
		return this.getDirectoryForDelegation().listStreaming();
	}

	async files(options?: { recursive?: boolean }): Promise<Array<StorageFile>> {
		return await this.getDirectoryForDelegation().files(options);
	}

	filesStreaming(options?: { recursive?: boolean }): AsyncGenerator<StorageFile, void> {
		return this.getDirectoryForDelegation().filesStreaming(options);
	}

	async directories(): Promise<Array<StorageDirectory>> {
		return await this.getDirectoryForDelegation().directories();
	}

	directoriesStreaming(): AsyncGenerator<StorageDirectory, void> {
		return this.getDirectoryForDelegation().directoriesStreaming();
	}

	async deleteAll(): Promise<void> {
		return await this.getDirectoryForDelegation().deleteAll();
	}

	directory(path: string): StorageDirectory {
		return this.getDirectoryForDelegation().directory(path);
	}

	file(path: string): StorageFile {
		return this.getDirectoryForDelegation().file(path);
	}

	async putFile(
		payload: (StorageFilePutPayload & { suggestedName?: string | undefined }) | File | Request,
	): Promise<StorageFile> {
		return await this.getDirectoryForDelegation().putFile(payload);
	}
}
