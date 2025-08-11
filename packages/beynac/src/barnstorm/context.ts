import { getKeyDefault, type Key } from "@/keys";
import type { Context } from "./public-types";

export class ContextImpl implements Context {
	private values: Map<Key, unknown>;
	private clone: ContextImpl | null = null;

	constructor(values?: Map<Key, unknown>) {
		this.values = values ?? new Map();
	}

	get<T, D = null>(key: Key<T, D>): T | D | null {
		// If we have a clone, read from it
		if (this.clone) {
			return this.clone.get(key);
		}
		const value = this.values.get(key);
		if (value !== undefined) {
			return value as T;
		}
		// Return the default value if provided, or null if no default
		const defaultValue = getKeyDefault(key) ?? null;
		if (defaultValue !== undefined) {
			return defaultValue as D;
		}
		return null;
	}

	set<T, D>(key: Key<T, D>, value: T): void {
		// Clone on first set if not already cloned
		if (!this.clone) {
			this.clone = new ContextImpl(new Map(this.values));
		}

		// Always set on the clone
		this.clone.values.set(key, value);
	}

	// Internal method to get and reset the clone
	_takeCloneAndReset(): ContextImpl | null {
		const cloned = this.clone;
		this.clone = null; // Reset for next sibling
		return cloned;
	}
}
