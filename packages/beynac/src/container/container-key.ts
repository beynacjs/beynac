import type { Key } from "@/keys";

/**
 * A constructor function (class reference)
 */
export type ClassReference<T = unknown> = abstract new () => T;

/**
 * A key that can be bound to a value in the IoC container
 */
export type KeyOrClass<T = unknown> = ClassReference<T> | Key<T>;

export const getKeyName = (key: KeyOrClass): string => {
	if (typeof key === "function") {
		return `[${key.name}]`;
	}
	// Keys are objects with a toString method
	if (typeof key === "object" && key !== null && "toString" in key) {
		return key.toString();
	}
	return "[unknown]";
};
