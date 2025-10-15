import { AnyConstructor } from "../utils";
import type { TypeToken } from "./type-token";

/**
 * A key that can be bound to a value in the IoC container
 */
export type KeyOrClass<T = unknown> = AnyConstructor<T> | TypeToken<T>;

export const getKeyName = (key: KeyOrClass): string => {
  if (typeof key === "function") {
    return `[${key.name}]`;
  }
  return key?.toString() ?? "[unknown]";
};
