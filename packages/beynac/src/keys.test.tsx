/** @jsxRuntime automatic **/
/** @jsxImportSource . **/
import { describe, it } from "bun:test";
import { expectTypeOf } from "expect-type";
import { type Key, key } from "./keys";

describe("keys", () => {
	it("key() with no arguments infers Key<unknown>", () => {
		const k = key();
		expectTypeOf(k).toEqualTypeOf<Key<unknown>>();
	});

	it("key() with just name infers Key<unknown>", () => {
		const k = key({ name: "myKey" });
		expectTypeOf(k).toEqualTypeOf<Key<unknown>>();
	});

	it("key() with default value infers type from default", () => {
		const k1 = key({ default: 4 });
		expectTypeOf(k1).toEqualTypeOf<Key<number>>();

		const k2 = key({ name: "myKey", default: "hello" });
		expectTypeOf(k2).toEqualTypeOf<Key<string>>();

		const k3 = key({ default: true });
		expectTypeOf(k3).toEqualTypeOf<Key<boolean>>();

		const k4 = key({ default: null });
		expectTypeOf(k4).toEqualTypeOf<Key<null>>();
	});

	it("key<T>() with no default infers Key<T | undefined>", () => {
		const k1 = key<string>();
		expectTypeOf(k1).toEqualTypeOf<Key<string | undefined>>();

		const k2 = key<string>({ name: "myKey" });
		expectTypeOf(k2).toEqualTypeOf<Key<string | undefined>>();

		const k3 = key<number | null>();
		expectTypeOf(k3).toEqualTypeOf<Key<number | null | undefined>>();
	});

	it("key<T>() with matching default infers Key<T>", () => {
		const k1 = key<string>({ default: "hello" });
		expectTypeOf(k1).toEqualTypeOf<Key<string>>();

		const k2 = key<number>({ name: "port", default: 3000 });
		expectTypeOf(k2).toEqualTypeOf<Key<number>>();
	});

	it("key<T>() with mismatched default causes type error", () => {
		// @ts-expect-error - default value must match type parameter
		const _k1 = key<string>({ default: 42 });

		// @ts-expect-error - default value must match type parameter
		const _k2 = key<boolean>({ default: "not a boolean" });
	});

	it("complex types work correctly", () => {
		interface User {
			name: string;
			age: number;
		}

		const k1 = key<User>();
		expectTypeOf(k1).toEqualTypeOf<Key<User | undefined>>();

		const k2 = key<User>({ default: { name: "Alice", age: 30 } });
		expectTypeOf(k2).toEqualTypeOf<Key<User>>();

		const k3 = key({ default: { name: "Bob", age: 25 } });
		expectTypeOf(k3).toEqualTypeOf<Key<{ name: string; age: number }>>();
	});

	it("union types work correctly", () => {
		const k1 = key<string | number>();
		expectTypeOf(k1).toEqualTypeOf<Key<string | number | undefined>>();

		const k2 = key<string | number>({ default: "hello" });
		expectTypeOf(k2).toEqualTypeOf<Key<string | number>>();

		const k3 = key<string | number>({ default: 42 });
		expectTypeOf(k3).toEqualTypeOf<Key<string | number>>();
	});

	it("nullable types work correctly", () => {
		const k1 = key<string | null>({ default: null });
		expectTypeOf(k1).toEqualTypeOf<Key<string | null>>();

		const k2 = key<string | null>();
		expectTypeOf(k2).toEqualTypeOf<Key<string | null | undefined>>();
	});
});
