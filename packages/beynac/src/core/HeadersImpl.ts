import { inject } from "../container/inject";
import type { Headers } from "../contracts/Headers";
import {
	type RequestContext as IRequestContext,
	RequestContext,
} from "../contracts/RequestContext";

export class HeadersImpl implements Headers {
	#keys: string[] | undefined;

	constructor(private requestContext: IRequestContext = inject(RequestContext)) {}

	get size(): number {
		return this.#getKeys().length;
	}

	get(name: string): string | null {
		return this.requestContext.getRequestHeader(name);
	}

	keys(): ReadonlyArray<string> {
		if (!this.#keys) {
			this.#keys = this.#getKeys();
		}
		return this.#keys;
	}

	entries(): ReadonlyArray<[string, string]> {
		const result: [string, string][] = [];
		for (const name of this.keys()) {
			const value = this.get(name);
			if (value !== null) {
				result.push([name, value]);
			}
		}
		return result;
	}

	get canModify(): boolean {
		return this.requestContext.setCookie !== null;
	}

	set(name: string, _value: string): void {
		if (!this.canModify) {
			throw new Error(
				`Cannot set header "${name}" in context "${this.requestContext.context}": headers are read-only`,
			);
		}
		// TODO: Implement setResponseHeader in RequestContext
		throw new Error("setResponseHeader not yet implemented in RequestContext");
	}

	#getKeys() {
		const names = this.requestContext.getRequestHeaderNames();
		return Array.from(names).map((name) => name.toLowerCase());
	}
}
