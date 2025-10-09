import type { Key } from "../keys";
import { NoArgConstructor } from "../utils";

/**
 * A key that can be bound to a value in the IoC container
 */
export type KeyOrClass<T = unknown> = NoArgConstructor<T> | Key<T>;

export const getKeyName = (key: KeyOrClass): string => {
  if (typeof key === "function") {
    return `[${key.name}]`;
  }
  return key?.toString() ?? "[unknown]";
};
