import { expect } from "bun:test";

type ErrorOwnProperties<T extends Error> = Omit<T, keyof Error>;

type Voidify<T> = T extends Promise<unknown> ? Promise<void> : void;

export function expectErrorWithProperties<T extends Error, R>(
	fn: () => R,
	errorClass: new (...args: never[]) => T,
	properties: ErrorOwnProperties<T>,
): Voidify<R> {
	const checkThrownValue = (err: unknown) => {
		expect(err).toBeInstanceOf(errorClass);
		for (const [key, value] of Object.entries(properties)) {
			expect((err as Record<string, unknown>)[key]).toBe(value);
		}
	};
	const shouldHaveThrown = () => {
		throw new Error(`Expected function to throw ${errorClass.name}`);
	};
	let thrown: unknown;
	let result: unknown;
	try {
		result = fn();
	} catch (err) {
		thrown = err;
	}
	if (result instanceof Promise) {
		return result.then(shouldHaveThrown, checkThrownValue) as Voidify<R>;
	}
	if (!thrown) {
		shouldHaveThrown();
	}
	checkThrownValue(thrown);
	return undefined as Voidify<R>;
}
