const ORIGINAL: unique symbol = Symbol("original");
const MOCK: unique symbol = Symbol("mock");

const resetCallbacks = new Set<WeakRef<() => void>>();

/**
 * Register a callback to be called when resetAllMocks() is invoked
 *
 * The list of callbacks is cleared every time resetAllMocks() is called, so
 * onResetAllMocks should be called every time a mock value is installed
 */
export function onResetAllMocks(callback: () => void): void {
	resetCallbacks.add(new WeakRef(callback));
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
	console.log(">>>>>> resetAllMocks");
	for (const ref of resetCallbacks) {
		const callback = ref.deref();
		if (callback !== undefined) {
			callback();
		}
	}
	resetCallbacks.clear();
}

export function isMockable(fn: unknown): fn is Mockable {
	return typeof fn === "function" && ORIGINAL in fn;
}

/**
 * Create a temporary directory that is automatically cleaned up and return its
 * absolute path.
 *
 * The directory is created on the real filesystem using Node.js
 * `mkdtempSync()`, so you can use standard filesystem operations to interact
 * with it. When `resetAllMocks()` is invoked, the directory and all its
 * contents are recursively deleted.
 *
 * @param prefix - Optional prefix for the temp directory name (defaults to
 * "beynac-test-")
 *
 * @returns
 *
 * @example
 * import { mockTmpDirectory, resetAllMocks } from "@beynac/testing/mocks";
 * import { afterEach, test } from "bun:test";
 *
 * afterEach(() => {
 *   resetAllMocks(); // Cleans up all temp directories
 * });
 *
 * test("filesystem operations", () => {
 *   const tempDir = mockTmpDirectory();
 *   // Use tempDir for file operations
 *   // Directory will be automatically deleted after test
 * });
 */
let i = 0;
export function mockTmpDirectory(prefix = "beynac-test-"): string {
	if (++i == 20) throw new Error("Too many mocks");
	const { mkdtempSync } = require("node:fs");
	const { join } = require("node:path");
	const { tmpdir } = require("node:os");
	const fs = require("node:fs/promises");

	const tempDir = mkdtempSync(join(tmpdir(), prefix));

	console.log("?????", tempDir);
	onResetAllMocks(async () => {
		console.log("!!!!!", tempDir);
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	return tempDir;
}
