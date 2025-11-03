import type { TypeToken } from "../container/container-key";
import { createTypeToken } from "../container/container-key";
import { AnyConstructor } from "../utils";

/**
 * The EventDispatcher interface defines methods for managing and dispatching events.
 *
 * Events are identified by their class constructor, and the event payload is an instance
 * of that class.
 *
 * @example
 * ```typescript
 * class UserRegistered {
 *   constructor(public userId: string, public email: string) {}
 * }
 *
 * dispatcher.addListener(UserRegistered, (event) => {
 *   console.log(`User ${event.email} registered`);
 * });
 *
 * dispatcher.dispatch(new UserRegistered("123", "user@example.com"));
 * ```
 */
export interface Dispatcher {
	/**
	 * Register a listener for a specific event type.
	 *
	 * The listener will be called whenever an event of the specified type is dispatched.
	 *
	 * You can listen on a superclass to receive events of all subclasses.
	 */
	addListener<T extends object>(event: AnyConstructor<T>, listener: (event: T) => void): void;

	/**
	 * Remove a previously registered listener.
	 */
	removeListener(event: AnyConstructor, listener: Function): void;

	/**
	 * Check if any listeners are registered for a specific event type.
	 *
	 * This can be used to avoid building an expensive event if there are no listeners.
	 */
	hasListener(eventClass: AnyConstructor): boolean;

	/**
	 * Dispatch an event to all registered listeners.
	 *
	 * Listeners are called in the order they were registered.
	 */
	dispatch<T extends object>(event: T): void;
}

export const Dispatcher: TypeToken<Dispatcher> = createTypeToken("Dispatcher");
