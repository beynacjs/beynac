import {
	NotFoundError,
	PermissionsError,
	StorageError,
	StorageHttpError,
	StorageUnknownError,
} from "./storage-errors";

export function storageOperation<T>(operation: string, fn: () => T): T {
	const toStorageError = (error: unknown): StorageError => {
		if (error instanceof StorageHttpError) {
			const status = error.statusCode;
			if (status === 404) {
				return new NotFoundError(error.path);
			}
			if (status === 401 || status === 403 || status === 407) {
				return PermissionsError.forHttpError(error.path, status);
			}
			return error;
		}
		if (error instanceof StorageError) {
			return error;
		}
		if (error instanceof Error) {
			return new StorageUnknownError(operation, error);
		}
		return new StorageUnknownError(operation, new Error(String(error)));
	};

	try {
		const result = fn();
		if (result instanceof Promise) {
			return result.catch((error) => {
				throw toStorageError(error);
			}) as T;
		}
		return result;
	} catch (error) {
		throw toStorageError(error);
	}
}
