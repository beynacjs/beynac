import type { RequestLocals } from "../contracts";
import type { Key } from "../keys";
import { BaseClass } from "../utils";

/**
 * Implementation of RequestLocals for request-scoped storage
 */
export class RequestLocalsImpl extends BaseClass implements RequestLocals {
	#storage = new Map<Key, unknown>();

	get<T>(key: Key<T>): T {
		if (this.#storage.has(key)) {
			return this.#storage.get(key) as T;
		}
		return key.default as T;
	}

	set<T>(key: Key<T>, value: T): void {
		this.#storage.set(key, value);
	}

	has(key: Key): boolean {
		return this.#storage.has(key);
	}

	delete(key: Key): void {
		this.#storage.delete(key);
	}
}
