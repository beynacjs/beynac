/** @jsxRuntime automatic **/
/** @jsxImportSource . **/
import { describe, expect, test } from "bun:test";
import { getPrototypeChain } from "./utils";

describe(getPrototypeChain, () => {
	class A {}
	class B extends A {}
	class C extends B {}

	test("work with instance", () => {
		const chain = Array.from(getPrototypeChain(new C()));
		expect(chain).toEqual([C, B, A, Object]);
	});

	test("work with classes", () => {
		const chain = Array.from(getPrototypeChain(C));
		expect(chain).toEqual([C, B, A, Object]);
	});
});
