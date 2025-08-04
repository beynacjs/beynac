declare const brand: unique symbol;

/**
 * A token representing an arbitrary type
 */
export type Key<T = unknown> = symbol & {
	[brand]: T;
};

/**
 * Create a token that allows typescript types that don't normally have a
 * runtime value associated (like interfaces) to be resolved in the IoC
 * container.
 *
 * @example
 * export interface Ship {
 *     sail(): void;
 * }
 * // the convention is to use the same name for the type and the token
 * export const Ship = typeKey<Ship>("Ship");
 *
 * @param name a name for debugging purposes
 */
export const key = <T>(name = "anonymous"): Key<T> => Symbol(name) as Key<T>;
