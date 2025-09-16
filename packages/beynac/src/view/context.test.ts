import { describe, expect, test } from "bun:test";
import { type Key, key } from "../keys";
import { ContextImpl } from "./context";
import { MarkupStream } from "./markup-stream";
import type { Context } from "./public-types";
import { expectTypeOf } from "expect-type";
import { asyncGate } from "../test-utils/async-gate";

describe("Context", () => {
  describe("basic operations", () => {
    test("get returns null for non-existent key", () => {
      const ctx = new ContextImpl();
      const testKey = key<string>({ name: "test" });
      expect(ctx.get(testKey)).toBeNull();
    });

    test("set and get work correctly", () => {
      const ctx = new ContextImpl();
      const testKey = key<string>({ name: "test" });
      ctx.set(testKey, "value");
      expect(ctx.get(testKey)).toBe("value");
    });

    test("get returns from clone after set is called", () => {
      const ctx = new ContextImpl();
      const key1 = key<string>({ name: "first" });
      const key2 = key<string>({ name: "second" });

      // Set initial value
      ctx.set(key1, "initial");

      // This should read from the clone
      const val1 = ctx.get(key1);
      expect(val1).toBe("initial");

      // Set another value
      ctx.set(key2, "second");

      // Both should be accessible from the clone
      expect(ctx.get(key1)).toBe("initial");
      expect(ctx.get(key2)).toBe("second");
    });
  });

  describe("context in rendering", () => {
    test("context propagates to children", () => {
      const testKey = key<string>({ name: "test" });
      const stream = new MarkupStream("div", null, [
        (ctx) => {
          ctx.set(testKey, "parent");
          return new MarkupStream("span", null, [
            (ctx) => ctx.get(testKey) || "not found",
          ]);
        },
      ]);
      expect(stream.render()).toBe("<div><span>parent</span></div>");
    });

    test("context changes don't affect siblings", () => {
      const testKey = key<string>({ name: "test" });
      const stream = new MarkupStream("div", null, [
        (ctx) => {
          ctx.set(testKey, "first");
          return "first";
        },
        (ctx) => ctx.get(testKey) || "empty", // Should be "empty"
      ]);
      expect(stream.render()).toBe("<div>firstempty</div>");
    });

    test("nested context overrides", () => {
      const testKey = key<string>({ name: "test" });
      const stream = new MarkupStream("div", null, [
        (ctx) => {
          ctx.set(testKey, "parent");
          const afterSet = ctx.get(testKey); // Should be "parent"
          return [
            (ctx) => {
              const parentValue = ctx.get(testKey);
              ctx.set(testKey, "child");
              // Check that parent value is still accessible in same function after child set
              const stillParent = ctx.get(testKey); // Should be "child" now
              return [
                `parent:${parentValue}`,
                "-",
                `afterChildSet:${stillParent}`,
                "-",
                (ctx) => `child:${ctx.get(testKey)}`,
              ];
            },
            "-",
            `afterSetInParent:${afterSet}`,
          ];
        },
      ]);
      expect(stream.render()).toBe(
        "<div>parent:parent-afterChildSet:child-child:child-afterSetInParent:parent</div>"
      );
    });

    test("context propagates through arrays", () => {
      const testKey = key<number>({ name: "count" });
      const stream = new MarkupStream("div", null, [
        (ctx) => {
          ctx.set(testKey, 1);
          return [
            "first:",
            (ctx) => String(ctx.get(testKey)),
            ["-second:", (ctx) => String(ctx.get(testKey))],
          ];
        },
      ]);
      expect(stream.render()).toBe("<div>first:1-second:1</div>");
    });

    test("context propagates through nested MarkupStreams", () => {
      const testKey = key<string>({ name: "theme" });
      const stream = new MarkupStream("div", null, [
        (ctx) => {
          ctx.set(testKey, "dark");
          return new MarkupStream("section", null, [
            new MarkupStream("p", null, [
              (ctx) => `Theme: ${ctx.get(testKey)}`,
            ]),
          ]);
        },
      ]);
      expect(stream.render()).toBe(
        "<div><section><p>Theme: dark</p></section></div>"
      );
    });

    test("context propagates through async functions", async () => {
      const testKey = key<string>({ name: "async" });
      const stream = new MarkupStream("div", null, [
        (ctx) => {
          ctx.set(testKey, "async-value");
          return Promise.resolve((ctx) => ctx.get(testKey) || "not found");
        },
      ]);
      const result = await stream.render();
      expect(result).toBe("<div>async-value</div>");
    });

    test("complex: function → promise → function → content", async () => {
      const testKey = key<string>({ name: "complex" });
      const complexContent = (ctx: Context) => {
        ctx.set(testKey, "level1");
        return Promise.resolve((ctx: Context) => {
          const val = ctx.get(testKey);
          return `final:${val}`;
        });
      };

      const stream = new MarkupStream("div", null, [
        "before ",
        complexContent,
        " after",
      ]);

      const result = await stream.render();
      expect(result).toBe("<div>before final:level1 after</div>");
    });

    test("even more complex: function → promise → function → promise → function", async () => {
      const testKey = key<string>({ name: "chain" });
      const veryComplex = (ctx: Context) => {
        ctx.set(testKey, "level1");
        return Promise.resolve((ctx: Context) => {
          const val1 = ctx.get(testKey);
          ctx.set(testKey, "level2");
          return Promise.resolve(
            (ctx: Context) => `${val1}-${ctx.get(testKey)}`
          );
        });
      };

      const stream = new MarkupStream("div", null, [
        "start ",
        veryComplex,
        " end",
      ]);

      const result = await stream.render();
      expect(result).toBe("<div>start level1-level2 end</div>");
    });

    test("context isolation between parallel siblings", () => {
      const key1 = key<string>({ name: "key1" });
      const key2 = key<string>({ name: "key2" });

      const stream = new MarkupStream("div", null, [
        (ctx) => {
          ctx.set(key1, "a");
          return [
            (ctx) => {
              ctx.set(key2, "b");
              return `1:${ctx.get(key1)}-${ctx.get(key2)}`;
            },
            (ctx) => `2:${ctx.get(key1) || "null"}-${ctx.get(key2) || "null"}`,
          ];
        },
        (ctx) => `3:${ctx.get(key1) || "null"}-${ctx.get(key2) || "null"}`,
      ]);

      expect(stream.render()).toBe("<div>1:a-b2:a-null3:null-null</div>");
    });

    test("multiple functions with shared context propagation", () => {
      const counterKey = key<number>({ name: "counter" });

      const incrementer = (ctx: Context) => {
        const current = ctx.get(counterKey) || 0;
        ctx.set(counterKey, current + 1);
        return String(current + 1);
      };

      const reader = (ctx: Context) => String(ctx.get(counterKey) || 0);

      const stream = new MarkupStream("div", null, [
        incrementer,
        "-",
        reader, // Should be 0 (sibling doesn't see the change)
        [
          (ctx) => {
            ctx.set(counterKey, 10);
            return [incrementer, "-", reader]; // incrementer sets to 11, but reader is a sibling so sees 10
          },
        ],
      ]);

      expect(stream.render()).toBe("<div>1-011-10</div>");
    });

    test.skip("async siblings can not pollute each other's context when running concurrently", async () => {
      // This test is intended to demonstrate that when two async components run
      // concurrently, they don't interfere with each other's context. But
      // because our renderer does not resolve promises in parallel, components
      // can't (yet!) render concurrently, and this test hangs waiting for the
      // second async component to run, which it won't until the first component
      // completes. This test should be restored when/if we implement parallel
      // rendering.
      //
      // There's an argument for not implementing parallel rendering - Laravel
      // doesn't do it, and it would use more memory.

      const gate = asyncGate(["sibling1_start", "sibling2_start", "read"]);
      const sibling1 = gate.task("sibling1");
      const sibling2 = gate.task("sibling2");

      const token = key<string>();

      const stream = new MarkupStream(null, null, [
        [
          async (ctx) => {
            await sibling1("sibling1_start");
            ctx.set(token, "value1");
            await sibling1("read");
            return `s1=${ctx.get(token)};`;
          },
          async (ctx) => {
            await sibling2("sibling2_start");
            ctx.set(token, "value2");
            await sibling2("read");
            return `s2=${ctx.get(token)};`;
          },
        ],
      ]);
      const renderPromise = stream.render();

      await gate.run();

      const result = await renderPromise;

      expect(result).toMatchInlineSnapshot();
    });
  });

  describe("edge cases", () => {
    test("empty context works correctly", () => {
      const stream = new MarkupStream("div", null, [(_ctx) => "works"]);
      expect(stream.render()).toBe("<div>works</div>");
    });

    test("context with existing values", () => {
      const testKey = key<string>({ name: "preset" });
      const initialValues = new Map<Key, unknown>();
      initialValues.set(testKey, "initial");

      const ctx = new ContextImpl(initialValues);
      const stream = new MarkupStream(
        "div",
        null,
        [(ctx) => ctx.get(testKey) || "missing"],
        ctx
      );
      expect(stream.render()).toBe("<div>initial</div>");
    });

    test("takeCloneAndReset resets clone for siblings", () => {
      const ctx = new ContextImpl();
      const testKey = key<string>({ name: "test" });

      // First use - creates clone
      ctx.set(testKey, "value1");
      const clone1 = ctx._takeCloneAndReset();
      expect(clone1).not.toBeNull();

      // After takeCloneAndReset, setting should create new clone
      ctx.set(testKey, "value2");
      const clone2 = ctx._takeCloneAndReset();
      expect(clone2).not.toBeNull();
      expect(clone2).not.toBe(clone1);
    });
  });

  describe("context get with defaults", () => {
    test("returns default when key not set", () => {
      const ctx = new ContextImpl();
      const keyWithDefault = key<string>({
        name: "test",
        default: "defaultValue",
      });
      const result = ctx.get(keyWithDefault);
      expect(result).toBe("defaultValue");
    });

    test("returns set value over default", () => {
      const ctx = new ContextImpl();
      const keyWithDefault = key({ name: "test", default: "defaultValue" });
      ctx.set(keyWithDefault, "setValue");
      const result = ctx.get(keyWithDefault);
      expect(result).toBe("setValue");
    });

    test("returns null for key without default", () => {
      const ctx = new ContextImpl();
      const keyWithoutDefault = key<string>({ name: "test" });
      const result = ctx.get(keyWithoutDefault);
      expect(result).toBeNull();
    });

    test("default with null value", () => {
      const ctx = new ContextImpl();
      const keyWithNullDefault = key<string | null>({
        name: "test",
        default: null,
      });
      const result = ctx.get(keyWithNullDefault);
      expect(result).toBe(null);
    });

    test("undefined default returns null (same as no default)", () => {
      const ctx = new ContextImpl();
      const keyWithUndefinedDefault = key<string | undefined>({
        name: "test",
        default: undefined,
      });
      // With current keys.ts, undefined default is same as no default - returns null
      const result = ctx.get(keyWithUndefinedDefault);
      expect(result).toBe(null);
    });
  });

  describe("context defaults in rendering", () => {
    test("default values propagate through context tree", () => {
      const themeKey = key({ name: "theme", default: "light" });
      const fontSizeKey = key({ name: "fontSize", default: 16 });

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
      const colorKey = key<string>({ name: "color", default: "blue" });

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
      const countKey = key<number>({ name: "count", default: 0 });

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
    const ctx = new ContextImpl();

    test("String key with default is nullable when got", () => {
      const keyWithDefault = key<string>({ name: "test", default: "default" });
      const result1 = ctx.get(keyWithDefault);
      expectTypeOf(result1).toEqualTypeOf<string | null>();
    });

    test("compile-time type checking for defaults", () => {
      const keyWithoutDefault = key<string>({ name: "test2" });
      const result2 = ctx.get(keyWithoutDefault);
      expectTypeOf(result2).toEqualTypeOf<string | null>();
    });
  });
});
