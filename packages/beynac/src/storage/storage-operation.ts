import type { Dispatcher } from "../contracts/Dispatcher";
import {
	NotFoundError,
	PermissionsError,
	StorageError,
	StorageHttpError,
	StorageUnknownError,
} from "./storage-errors";
import {
	StorageOperationCompletedEvent,
	StorageOperationFailedEvent,
	type StorageOperationStartingEvent,
	type StorageOperationType,
} from "./storage-events";

export async function storageOperation<TResult, TStartEvent extends StorageOperationStartingEvent>(
	operationType: StorageOperationType,
	fn: () => Promise<TResult>,
	beforeEvent: () => TStartEvent,
	afterEvent: (startEvent: TStartEvent, result: TResult) => StorageOperationCompletedEvent,
	dispatcher: Dispatcher,
): Promise<TResult> {
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
			return new StorageUnknownError(operationType, error);
		}
		return new StorageUnknownError(operationType, new Error(String(error)));
	};

	const startEvent = beforeEvent();

	if (startEvent.type !== operationType) {
		throw new Error(
			`Event type mismatch: expected "${operationType}" but event has type "${startEvent.type}"`,
		);
	}

	dispatcher.dispatch(startEvent);

	try {
		const result = await fn();
		dispatcher.dispatch(afterEvent(startEvent, result));
		return result;
	} catch (error) {
		const storageError = toStorageError(error);
		dispatcher.dispatch(new StorageOperationFailedEvent(startEvent, storageError));
		throw storageError;
	}
}
