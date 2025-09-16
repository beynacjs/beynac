import { describe, expect, test } from "bun:test";
import { type Key, key } from "@/keys";
import { ContextImpl } from "./context";
import { MarkupStream } from "./markup-stream";
import type { Context } from "./public-types";

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
});
