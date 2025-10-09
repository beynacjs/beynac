export const arrayWrap = <T>(value: T | T[]): T[] => {
  return Array.isArray(value) ? value : [value];
};

export const describeType = (value: unknown): string =>
  value == null ? String(value) : typeof value;

abstract class MultiMap<K, V> {
  abstract add(key: K, value: V): void;

  addAll(keys: K | K[], values: V | V[]): void {
    for (const key of arrayWrap(keys)) {
      for (const value of arrayWrap(values)) {
        this.add(key, value);
      }
    }
  }
}

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
    return this.#map.get(key)?.size !== 0;
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
