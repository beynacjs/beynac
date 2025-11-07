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

	async files(): Promise<StorageFile[]> {
		return await this.getDirectoryForDelegation().files();
	}

	async allFiles(): Promise<StorageFile[]> {
		return await this.getDirectoryForDelegation().allFiles();
	}

	async directories(): Promise<StorageDirectory[]> {
		return await this.getDirectoryForDelegation().directories();
	}

	async allDirectories(): Promise<StorageDirectory[]> {
		return await this.getDirectoryForDelegation().allDirectories();
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
