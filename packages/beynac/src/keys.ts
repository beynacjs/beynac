const keyDefault: unique symbol = Symbol("keyDefault");
const keyBrand: unique symbol = Symbol("keyBrand");

/**
 * A token representing an arbitrary type with optional default value
 */
export type Key<T = unknown> = {
	readonly [keyDefault]: unknown;
	readonly [keyBrand]?: T;
};

export const isKey = (value: unknown): value is Key => value instanceof KeyImpl;

export const getKeyDefault = <T>(key: Key<T>): unknown => key[keyDefault];

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
 * export const Ship = key<Ship>({ name: "Ship" });
 *
 * // With default value
 * export const Port = key({ name: "Port", default: 3000 });
 *
 * @param options - Object with optional name and default value
 */
export function key(options?: { name?: string }): Key<unknown>;
export function key<T>(options?: { name?: string }): Key<T | undefined>;
export function key<T>(options: { name?: string; default: T }): Key<T>;
export function key<T = unknown>(
	options: { name?: string; default?: T } = {},
): Key<T> | Key<T | undefined> | Key<unknown> {
	const { name = "anonymous", default: defaultValue } = options;
	return new KeyImpl<T>(name, defaultValue);
}

class KeyImpl<T> implements Key<T> {
	#name: string;
	[keyDefault]: unknown;
	[keyBrand]?: T;

	constructor(name: string, defaultValue?: unknown) {
		this.#name = name;
		this[keyDefault] = defaultValue;
	}

	toString(): string {
		return `[${this.#name}]`;
	}
}
