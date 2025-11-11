export const arrayWrap = <T>(value: T | T[]): T[] => {
	return Array.isArray(value) ? value : [value];
};

export const arrayWrapOptional = <T>(value: T | T[] | null | undefined): T[] =>
	value == null ? [] : arrayWrap(value);

export const describeType = (value: unknown): string =>
	value == null ? String(value) : typeof value;

/**
 * Base class that provides a toString() implementation.
 * Subclasses can override getToStringExtra() to add additional information.
 *
 * @example
 * class MyClass extends BaseClass {
 *     protected override getToStringExtra(): string | undefined {
 *         return "extra info";
 *     }
 * }
 * // toString() returns "[MyClass extra info]"
 */
export abstract class BaseClass {
	toString(): string {
		const extra = this.getToStringExtra();
		if (extra) {
			return `[${this.constructor.name} ${extra}]`;
		}
		return `[${this.constructor.name}]`;
	}

	protected getToStringExtra(): string | undefined {
		return undefined;
	}
}

abstract class MultiMap<K, V> extends BaseClass {
	abstract add(key: K, value: V): void;

	addAll(keys: K | K[], values: V | V[]): void {
		for (const key of arrayWrap(keys)) {
			for (const value of arrayWrap(values)) {
				this.add(key, value);
			}
		}
	}
}

type WithoutUndefinedValues<T extends Record<string, unknown>> = {
	[K in keyof T]: Exclude<T[K], undefined>;
};

/**
 * Given a record, return a version of the record with all key/value pairs whose
 * value is undefined removed. Useful for passing records to APIs when
 * exactOptionalPropertyTypes is enabled.
 */
export const withoutUndefinedValues = <T extends Record<string, unknown>>(
	input: T,
): WithoutUndefinedValues<T> =>
	Object.fromEntries(
		Object.entries(input).filter((e) => e[1] !== undefined),
	) as WithoutUndefinedValues<T>;

export class SetMultiMap<K, V> extends MultiMap<K, V> {
	#map = new Map<K, Set<V>>();

	add(key: K, value: V): void {
		let set = this.#map.get(key);
		if (!set) {
			set = new Set();
			this.#map.set(key, set);
		}
		set.add(value);
	}

	get(key: K): Iterable<V> {
		const set = this.#map.get(key);
		return set?.values() ?? emptyIterable;
	}

	has(key: K, value: V): boolean {
		return this.#map.get(key)?.has(value) ?? false;
	}

	hasAny(key: K): boolean {
		const set = this.#map.get(key);
		return set !== undefined && set.size > 0;
	}

	delete(key: K, value: V): void {
		const set = this.#map.get(key);
		if (set) {
			set.delete(value);
			if (set.size === 0) {
				this.#map.delete(key);
			}
		}
	}

	deleteAll(key: K): void {
		this.#map.delete(key);
	}

	removeByValue(value: V): void {
		for (const set of this.#map.values()) {
			set.delete(value);
		}
	}

	clear(): void {
		this.#map.clear();
	}
}

const emptyIterable: Iterable<never> = Object.freeze([]);

export class ArrayMultiMap<K, V> extends MultiMap<K, V> {
	#map = new Map<K, V[]>();

	add(key: K, value: V): void {
		let set = this.#map.get(key);
		if (!set) {
			set = [];
			this.#map.set(key, set);
		}
		set.push(value);
	}

	get(key: K): Iterable<V> {
		const set = this.#map.get(key);
		return set?.values() ?? emptyIterable;
	}

	deleteAll(key: K): void {
		this.#map.delete(key);
	}

	clear(): void {
		this.#map.clear();
	}
}

/**
 * Extract method names from T that have no required arguments (all parameters are optional)
 */
export type MethodNamesWithNoRequiredArgs<T> = {
	[K in keyof T]: T[K] extends () => unknown ? K : never;
}[keyof T];

/**
 * A reference to any constructor - can not be instantiated
 */
export type AnyConstructor<T = unknown> = abstract new (...args: never[]) => T;

/**
 * A constructor function that accepts no arguments
 */
export type NoArgConstructor<T = unknown> = abstract new () => T;

/**
 * Walks up the prototype chain from an instance or constructor.
 * Returns an array of each constructor in the chain from most specific to least specific,
 * including Object.
 *
 * @param instanceOrClass - Either an instance of a class or a constructor function
 * @returns Array of constructor functions in the prototype chain
 */
export function getPrototypeChain(instanceOrClass: object | AnyConstructor): AnyConstructor[] {
	const result: AnyConstructor[] = [];

	// Start with the appropriate prototype based on input type
	let prototype: unknown =
		typeof instanceOrClass === "function"
			? instanceOrClass.prototype
			: Object.getPrototypeOf(instanceOrClass);

	// Walk up the prototype chain
	while (prototype) {
		const constructor = (prototype as { constructor: AnyConstructor }).constructor;
		if (typeof constructor === "function") {
			result.push(constructor);
		}
		if (prototype === Object.prototype) {
			break;
		}
		prototype = Object.getPrototypeOf(prototype);
	}

	return result;
}

export const plural = (word: string): string => word + "s";

export const pluralCount = (count: number, word: string): string =>
	count + " " + (count === 1 ? word : plural(word));

export const regExpEscape = (str: string): string =>
	// @ts-expect-error - Bun runtime supports RegExp.escape but TypeScript types don't include it yet
	RegExp.escape(str);
