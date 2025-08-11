const keyDefault: unique symbol = Symbol("keyDefault");
const keyBrand: unique symbol = Symbol("keyBrand");

/**
 * A token representing an arbitrary type with optional default value
 */
export type Key<T = unknown, D = unknown> = {
	readonly [keyDefault]: D | undefined;
	readonly [keyBrand]?: T;
};

export const isKey = (value: unknown): value is Key =>
	value instanceof KeyImpl;

export const getKeyDefault = <T, D>(key: Key<T, D>): D | undefined =>
	key[keyDefault];

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
 * export const Ship = key<Ship>("Ship");
 *
 * // With default value
 * export const Port = key<number>("Port", 3000);
 *
 * @param name a name for debugging purposes
 * @param defaultValue optional default value (defaults to null)
 */
export function key<T, D extends T = never>(
	name = "anonymous",
	defaultValue: D | undefined = undefined,
): Key<T, D> {
	return new KeyImpl<T, D>(name, defaultValue);
}

class KeyImpl<T, D> implements Key<T, D> {
	#name: string;
	[keyDefault]: D | undefined;
	[keyBrand]?: T;

	constructor(name: string, defaultValue?: D) {
		this.#name = name;
		this[keyDefault] = defaultValue;
	}

	toString(): string {
		return `[${this.#name}]`;
	}
}
