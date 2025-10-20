import { BeynacError } from "../error";

/**
 * Wraps a params object in a Proxy that throws when accessing non-existent parameters.
 * The Proxy behaves identically to a plain object for all introspection operations
 * (for...in, Object.keys, 'in' operator, etc.), but throws an error when attempting
 * to access a property that doesn't exist.
 *
 * This is intended for development mode to catch typos and mismatched route parameters early.
 *
 * @param params - The route parameters object
 * @returns A Proxy that throws on invalid property access
 *
 * @example
 * const params = wrapParams({ id: "123" });
 * params.id; // "123"
 * params.nonExistent; // throws: Route parameter "nonExistent" does not exist
 * 'id' in params; // true
 * 'nonExistent' in params; // false
 */
export function wrapParams(params: Record<string, string>): Record<string, string> {
  return new Proxy(params, {
    get(target, prop, receiver) {
      // Allow access to symbol properties (like Symbol.iterator)
      if (typeof prop === "symbol") {
        return Reflect.get(target, prop, receiver) as unknown;
      }

      // Throw if trying to access a property that doesn't exist
      if (!(prop in target)) {
        throw new BeynacError(`Route parameter "${String(prop)}" does not exist`);
      }

      return Reflect.get(target, prop, receiver);
    },

    // Support 'key' in params
    has(target, prop) {
      return Reflect.has(target, prop);
    },

    // Support Object.keys(), Object.getOwnPropertyNames(), for...in
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },

    // Support Object.getOwnPropertyDescriptor()
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });
}
