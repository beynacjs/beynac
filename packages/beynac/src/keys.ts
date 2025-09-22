const keyBrand: unique symbol = Symbol("keyBrand");

/**
 * A token representing an arbitrary type with optional default value
 */
export type Key<T = unknown> = {
  readonly default: T | undefined;
  readonly [keyBrand]?: T;
  toString(): string;
};

class KeyImpl<T> implements Key<T> {
  #name: string;
  default: T | undefined;
  [keyBrand]?: T;

  constructor(name: string, defaultValue?: T) {
    this.#name = name;
    this.default = defaultValue;
  }

  toString(): string {
    return `[${this.#name}]`;
  }
}

export const isKey = (value: unknown): value is Key => value instanceof KeyImpl;

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
export function createKey(options?: { name?: string }): Key<unknown>;
export function createKey<T>(options?: { name?: string }): Key<T | undefined>;
export function createKey<T>(options: { name?: string; default: T }): Key<T>;
export function createKey<T = unknown>(
  options: { name?: string; default?: T } = {},
): Key<T> | Key<T | undefined> | Key<unknown> {
  const { name = "anonymous", default: defaultValue } = options;
  return new KeyImpl<T>(name, defaultValue);
}
