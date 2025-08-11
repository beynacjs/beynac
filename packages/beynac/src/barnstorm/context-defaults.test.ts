import { describe, expect, test } from "bun:test";
import { key } from "@/keys";
import { ContextImpl } from "./context";
import { MarkupStream } from "./markup-stream";

describe("Context with default values", () => {

	describe("context get with defaults", () => {
		test("returns default when key not set", () => {
			const ctx = new ContextImpl();
			const keyWithDefault = key<string, string>("test", "defaultValue");
			const result = ctx.get(keyWithDefault);
			expect(result).toBe("defaultValue");
		});

		test("returns set value over default", () => {
			const ctx = new ContextImpl();
			const keyWithDefault = key("test", "defaultValue");
			ctx.set(keyWithDefault, "setValue");
			const result = ctx.get(keyWithDefault);
			expect(result).toBe("setValue");
		});

		test("returns null for key without default", () => {
			const ctx = new ContextImpl();
			const keyWithoutDefault = key<string>("test");
			// Context always returns null when no value exists and no default provided
			const result = ctx.get(keyWithoutDefault);
			expect(result).toBeNull();
		});

		test("default values work with different types", () => {
			const ctx = new ContextImpl();

			const numberKey = key<number, number>("num", 42);
			expect(ctx.get(numberKey)).toBe(42);

			const boolKey = key<boolean, boolean>("bool", true);
			expect(ctx.get(boolKey)).toBe(true);

			const objectKey = key<{ name: string }, { name: string }>("obj", {
				name: "default",
			});
			expect(ctx.get(objectKey)).toEqual({ name: "default" });

			const arrayKey = key<number[], number[]>("arr", [1, 2, 3]);
			expect(ctx.get(arrayKey)).toEqual([1, 2, 3]);
		});

		test("default with null value", () => {
			const ctx = new ContextImpl();
			const keyWithNullDefault = key<string | null, null>("test", null);
			const result = ctx.get(keyWithNullDefault);
			expect(result).toBe(null);
		});

		test("undefined default returns null (same as no default)", () => {
			const ctx = new ContextImpl();
			const keyWithUndefinedDefault = key<string | undefined, undefined>(
				"test",
				undefined,
			);
			// With current keys.ts, undefined default is same as no default - returns null
			const result = ctx.get(keyWithUndefinedDefault);
			expect(result).toBe(null);
		});
	});

	describe("context defaults in rendering", () => {
		test("default values propagate through context tree", () => {
			const themeKey = key<string, string>("theme", "light");
			const fontSizeKey = key<number, number>("fontSize", 16);

			const stream = new MarkupStream("div", null, [
				(ctx) => {
					// Should get default values
					const theme = ctx.get(themeKey);
					const fontSize = ctx.get(fontSizeKey);
					return `theme:${theme},size:${fontSize}`;
				},
			]);

			expect(stream.render()).toBe("<div>theme:light,size:16</div>");
		});

		test("overridden defaults in child context", () => {
			const colorKey = key<string, string>("color", "blue");

			const stream = new MarkupStream("div", null, [
				(ctx) => {
					const defaultColor = ctx.get(colorKey);
					ctx.set(colorKey, "red");
					return [
						`default:${defaultColor}`,
						(ctx) => `,override:${ctx.get(colorKey)}`,
					];
				},
			]);

			expect(stream.render()).toBe("<div>default:blue,override:red</div>");
		});

		test("sibling contexts get default values", () => {
			const countKey = key<number, number>("count", 0);

			const stream = new MarkupStream("div", null, [
				(ctx) => {
					ctx.set(countKey, 10);
					return `first:${ctx.get(countKey)}`;
				},
				(ctx) => `,second:${ctx.get(countKey)}`, // Should get default 0, not 10
			]);

			expect(stream.render()).toBe("<div>first:10,second:0</div>");
		});
	});

	describe("type inference", () => {
		test("compile-time type checking for defaults", () => {
			const ctx = new ContextImpl();

			// Key with default - should not include null in type
			const keyWithDefault = key<string, string>("test", "default");
			const result1: string = ctx.get(keyWithDefault); // Should compile without null check
			expect(result1).toBe("default");

			// Key without default - should include null in type
			const keyWithoutDefault = key<string>("test2");
			const result2: string | null = ctx.get(keyWithoutDefault); // Must include null
			expect(result2).toBeNull();

			// This would be a compile error if uncommented:
			// const result3: string = ctx.get(keyWithoutDefault);
		});
	});
});
