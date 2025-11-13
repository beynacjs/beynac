import type { Dispatcher } from "../contracts/Dispatcher";
import { NotFoundError, StorageError, StorageUnknownError } from "./storage-errors";
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
	options: { onNotFound?: Awaited<ReturnType<TFn>> } = {},
): ReturnType<TFn> {
	const startEvent = beforeEvent();

	if (startEvent.type !== operationType) {
		throw new Error(
			`Event type mismatch: expected "${operationType}" but event has type "${startEvent.type}"`,
		);
	}

	const handleStorageError = (error: unknown): ReturnType<TFn> | void => {
		if ("onNotFound" in options && error instanceof NotFoundError) {
			return options.onNotFound;
		}

		let storageError =
			error instanceof StorageError ? error : new StorageUnknownError(operationType, error);

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
				handleStorageError(error);
			}
		})() as ReturnType<TFn>;
	}

	return result
		.then((value) => {
			dispatcher.dispatch(afterEvent(startEvent, value as EventValueForFn<TFn>));
			return value;
		})
		.catch(handleStorageError) as ReturnType<TFn>;
}
