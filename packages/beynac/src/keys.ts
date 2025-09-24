/**
 * A token representing an arbitrary type with optional default value
 */
export type Key<T = unknown> = {
  readonly default: T | undefined;
  toString(): string;
};

class KeyImpl<T> implements Key<T> {
  #name: string;
  default: T | undefined;

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
 * export const Ship = key<Ship>({ displayName: "Ship" });
 *
 * // With default value
 * export const Port = key({ displayName: "Port", default: 3000 });
 *
 * @param options.displayName - A name to
 */
export function createKey(options?: { displayName?: string }): Key<unknown>;
export function createKey<T>(options?: { displayName?: string }): Key<T | undefined>;
export function createKey<T>(options: { displayName?: string; default: T }): Key<T>;
export function createKey<T = unknown>(
  options: { displayName?: string; default?: T } = {},
): Key<T> | Key<T | undefined> | Key<unknown> {
  const { displayName: name = "anonymous", default: defaultValue } = options;
  return new KeyImpl<T>(name, defaultValue);
}
