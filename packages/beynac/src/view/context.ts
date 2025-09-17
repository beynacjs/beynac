import { type Key } from "../keys";
import type { Context } from "./public-types";

export class ContextImpl implements Context {
  private localValues: Map<Key, unknown> = new Map();
  private parent: ContextImpl | null;
  private modified = false;

  constructor(parent?: ContextImpl) {
    this.parent = parent ?? null;
  }

  get<T>(key: Key<T>): Exclude<T | null, undefined> {
    if (this.localValues.has(key)) {
      const result = this.localValues.get(key);
      return result as Exclude<T | null, undefined>;
    }
    if (this.parent) {
      return this.parent.get(key);
    }
    return (key.default ?? null) as Exclude<T | null, undefined>;
  }

  set<T>(key: Key<T>, value: T): void {
    this.localValues.set(key, value);
    this.modified = true;
  }

  fork(): ContextImpl {
    return new ContextImpl(this);
  }

  wasModified(): boolean {
    return this.modified;
  }
}
