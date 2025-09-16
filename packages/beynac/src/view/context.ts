import { type Key } from "../keys";
import type { Context } from "./public-types";

export class ContextImpl implements Context {
  private values: Map<Key, unknown>;
  // Copy-on-write clone
  private clone: ContextImpl | null = null;

  constructor(values?: Map<Key, unknown>) {
    this.values = values ?? new Map<Key, unknown>();
  }

  get<T>(key: Key<T>): Exclude<T | null, undefined> {
    if (this.clone) {
      return this.clone.get(key);
    }
    const result = this.values.get(key) ?? key.default ?? null;
    return result as Exclude<T | null, undefined>;
  }

  set<T>(key: Key<T>, value: T): void {
    this.clone ??= new ContextImpl(new Map(this.values));
    this.clone.values.set(key, value);
  }

  _takeCloneAndReset(): ContextImpl | null {
    const cloned = this.clone;
    this.clone = null;
    return cloned;
  }
}
