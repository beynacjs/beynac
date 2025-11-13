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

/**
 * Conditional type to extract the event value based on function return type:
 * - AsyncGenerator -> number (count of yielded items)
 * - Promise<T> -> T (the resolved value)
 */
type EventValueForFn<TFn> = TFn extends () => AsyncGenerator<unknown, unknown, unknown>
	? number
	: TFn extends () => Promise<infer TResult>
		? TResult
		: never;

export function storageOperation<
	TFn extends (() => Promise<unknown>) | (() => AsyncGenerator<unknown, unknown, unknown>),
	TStartEvent extends StorageOperationStartingEvent,
>(
	operationType: StorageOperationType,
	fn: TFn,
	beforeEvent: () => TStartEvent,
	afterEvent: (
		startEvent: TStartEvent,
		result: EventValueForFn<TFn>,
	) => StorageOperationCompletedEvent,
	dispatcher: Dispatcher,
): ReturnType<TFn> {
	const startEvent = beforeEvent();

	if (startEvent.type !== operationType) {
		throw new Error(
			`Event type mismatch: expected "${operationType}" but event has type "${startEvent.type}"`,
		);
	}

	const throwStorageError = (error: unknown): never => {
		let storageError: StorageError;

		if (error instanceof StorageHttpError) {
			const status = error.statusCode;
			if (status === 404) {
				storageError = new NotFoundError(error.path);
			} else if (status === 401 || status === 403 || status === 407) {
				storageError = PermissionsError.forHttpError(error.path, status);
			} else {
				storageError = error;
			}
		} else if (error instanceof StorageError) {
			storageError = error;
		} else if (error instanceof Error) {
			storageError = new StorageUnknownError(operationType, error);
		} else {
			storageError = new StorageUnknownError(operationType, new Error(String(error)));
		}

		dispatcher.dispatch(new StorageOperationFailedEvent(startEvent, storageError));
		throw storageError;
	};

	dispatcher.dispatch(startEvent);

	const result = fn();

	if (Symbol.asyncIterator in result) {
		return (async function* () {
			let count = 0;
			try {
				for await (const value of result as AsyncGenerator<unknown, unknown, unknown>) {
					count++;
					yield value;
				}
				dispatcher.dispatch(afterEvent(startEvent, count as EventValueForFn<TFn>));
			} catch (error) {
				throwStorageError(error);
			}
		})() as ReturnType<TFn>;
	}

	return result
		.then((value) => {
			dispatcher.dispatch(afterEvent(startEvent, value as EventValueForFn<TFn>));
			return value;
		})
		.catch(throwStorageError) as ReturnType<TFn>;
}
