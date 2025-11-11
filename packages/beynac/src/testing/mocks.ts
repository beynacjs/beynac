const ORIGINAL: unique symbol = Symbol("original");
const MOCK: unique symbol = Symbol("mock");

const resetCallbacks = new Set<() => void>();

/**
 * Register a callback to be called when resetAllMocks() is invoked
 *
 * The list of callbacks is cleared every time resetAllMocks() is called, so
 * onResetAllMocks should be called every time a mock value is installed
 */
export function onResetAllMocks(callback: () => void): void {
	resetCallbacks.add(callback);
}

type Mockable = Function & { [ORIGINAL]: Function; [MOCK]: Function | null };

/**
 * Create a named function that delegates to the provided function.
 * Uses eval in environments that support it, falls back to unnamed function otherwise.
 *
 * @param name - The name for the new function
 * @param fn - The function to delegate to
 * @returns A new function with the specified name
 */
function withFunctionName<F extends Function>(name: string, fn: F): F {
	if (!name) return fn;

	try {
		// Try to create a named function using eval with minimal code
		// This is wrapped in try-catch for environments that don't support eval (e.g., Cloudflare Workers)
		return eval(`(function ${name}(...args) {
			return fn.apply(this, args);
		})`) as F;
	} catch {
		return fn;
	}
}

/**
 * Wraps a function to make it mockable for testing.
 *
 * @example
 * export const randomId = mockable((length = 21): string => {
 *   return random(length);
 * });
 */
export function mockable<F extends Function>(fn: F): F {
	const impl = withFunctionName(fn.name, function (this: unknown, ...args: unknown[]): unknown {
		if (wrapper[MOCK] != null) {
			return wrapper[MOCK].apply(this, args);
		}
		return wrapper[ORIGINAL].apply(this, args);
	});

	const wrapper: Mockable = Object.assign(impl, {
		[ORIGINAL]: fn,
		[MOCK]: null,
	});

	return wrapper as unknown as F;
}

/**
 * Mock a mockable function with a custom implementation.
 *
 * @param fn - The mockable function to mock
 * @param impl - The mock implementation (must match the original function signature)
 * @throws Error if fn is not mockable
 *
 * @example
 * mock(randomId, () => "test-id-123");
 * mock(randomId, (length) => "x".repeat(length));
 */
export function mock<F extends Function>(fn: F, impl: F): void {
	if (!isMockable(fn)) {
		throw new Error(
			"Cannot mock function: not created with mockable(). Use mockable() to wrap functions that need mocking support.",
		);
	}
	fn[MOCK] = impl;

	// Register a callback to reset this mock
	onResetAllMocks(() => {
		fn[MOCK] = null;
	});
}

/**
 * Reset a mocked function to its original implementation.
 *
 * @param fn - The mockable function to reset
 * @throws Error if fn is not mockable
 *
 * @example
 * mock(randomId, () => "test-id");
 * // ... tests ...
 * resetMock(randomId);
 */
export function resetMock(fn: Function): void {
	if (!isMockable(fn)) {
		throw new Error(
			`Cannot reset ${fn.name ? "function " + fn.name : "anonymous function"}: not created with mockable(). Use mockable() to wrap functions that need mocking support.`,
		);
	}
	fn[MOCK] = null;
}

/**
 * Reset all mocked functions across the Beynac library. This includes mockable functions and time mocks.
 *
 * @example
 * afterEach(() => {
 *   resetAllMocks();
 * });
 */
export function resetAllMocks(): void {
	for (const callback of resetCallbacks) {
		callback();
	}
	resetCallbacks.clear();
}

export function isMockable(fn: unknown): fn is Mockable {
	return typeof fn === "function" && ORIGINAL in fn;
}
