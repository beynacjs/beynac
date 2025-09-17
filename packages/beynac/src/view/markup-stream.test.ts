import { describe, expect, test } from "bun:test";
import { asyncGate } from "../test-utils/async-gate";
import { MarkupStream } from "./markup-stream";
import type { Content } from "./public-types";

describe("MarkupStream", () => {
  describe("basic functionality", () => {
    test("renders empty content", async () => {
      const emptyStream = new MarkupStream(null, null, null);
      expect(await emptyStream.render()).toBe("");

      const emptyTag = new MarkupStream("br", null, null);
      expect(await emptyTag.render()).toBe("<br>");
    });

    test("renders text content", async () => {
      const plainText = new MarkupStream(null, null, ["Hello World"]);
      expect(await plainText.render()).toBe("Hello World");

      const taggedText = new MarkupStream("div", null, ["Hello"]);
      expect(await taggedText.render()).toBe("<div>Hello</div>");
    });

    test("renders tag with attributes", async () => {
      const stream = new MarkupStream(
        "div",
        { id: "test", class: "container" },
        ["Content"]
      );
      expect(await stream.render()).toBe(
        '<div id="test" class="container">Content</div>'
      );
    });

    test("renders numbers", async () => {
      const stream = new MarkupStream(null, null, [42, " is the answer"]);
      expect(await stream.render()).toBe("42 is the answer");
    });

    test("skips null, undefined, and boolean values", async () => {
      const stream = new MarkupStream(null, null, [
        "start",
        null,
        undefined,
        true,
        false,
        "end",
      ]);
      expect(await stream.render()).toBe("startend");
    });

    test("renders nested arrays", async () => {
      const stream = new MarkupStream(null, null, [
        "a",
        ["b", ["c", "d"], "e"],
        "f",
      ]);
      const chunks = await Array.fromAsync(stream.renderChunks());
      // All synchronous content should be in a single chunk
      expect(chunks).toEqual(["abcdef"]);
    });

    test("renders arrays with mixed async content", async () => {
      const stream = new MarkupStream(null, null, [
        ["a", Promise.resolve("b")],
        [Promise.resolve(["c", "d"] as Content[])],
      ]);

      const result = await stream.render();
      expect(result).toBe("abcd");
    });

    test("renders empty arrays at various nesting levels", async () => {
      const stream = new MarkupStream(null, null, [
        "a",
        [],
        ["b", [], "c"],
        [[], [[]]],
        "d",
      ]);
      expect(await stream.render()).toBe("abcd");
    });

    test("renders arrays with all skippable values", async () => {
      const stream = new MarkupStream(null, null, [
        "start",
        [null, undefined, true, false],
        [[null], [undefined, [true, false]]],
        "end",
      ]);
      expect(await stream.render()).toBe("startend");
    });

    test("renders promises resolving to nested arrays", async () => {
      const stream = new MarkupStream(null, null, [
        "before ",
        Promise.resolve(["a", ["b", "c"]] as Content[]),
        " after",
      ]);

      const chunks = await Array.fromAsync(stream.renderChunks());
      // First chunk: sync content before promise
      // Second chunk: resolved promise content + remaining sync content
      expect(chunks).toEqual(["before ", "abc after"]);
    });

    test("renders nested MarkupStreams", async () => {
      const inner = new MarkupStream("span", { id: "inner" }, ["inner"]);
      const outer = new MarkupStream("div", { id: "outer" }, [
        "before ",
        inner,
        " after",
      ]);
      const chunks = await Array.fromAsync(outer.renderChunks());
      // All synchronous nested content in a single chunk
      expect(chunks).toEqual([
        '<div id="outer">before <span id="inner">inner</span> after</div>',
      ]);
    });
  });

  describe("attribute handling", () => {
    test("handles boolean attributes in HTML mode", async () => {
      const stream = new MarkupStream(
        "input",
        { disabled: true, hidden: false, checked: true },
        []
      );
      expect(await stream.render()).toBe("<input disabled checked>");
    });

    test("skips null, undefined, and function attributes", async () => {
      const stream = new MarkupStream(
        "div",
        {
          id: "test",
          nullAttr: null,
          undefinedAttr: undefined,
          funcAttr: function foo() {},
        },
        []
      );
      expect(await stream.render()).toBe(
        '<div id="test" funcAttr="function foo() {}"></div>'
      );
    });

    test("escapes attribute values", async () => {
      const stream = new MarkupStream(
        "div",
        {
          title: 'Test "quotes" & <brackets>',
          "data-value": "It's a test",
        },
        []
      );
      expect(await stream.render()).toBe(
        `<div title="Test &quot;quotes&quot; &amp; &lt;brackets&gt;" data-value="It's a test"></div>`
      );
    });

    test("escapes attribute values", async () => {
      const stream = new MarkupStream(
        "div",
        {
          title: 'Test "quotes" & <brackets>',
          "data-value": "It's a test",
        },
        []
      );
      expect(await stream.render()).toBe(
        `<div title="Test &quot;quotes&quot; &amp; &lt;brackets&gt;" data-value="It's a test"></div>`
      );
    });

    test("escapes content", async () => {
      const stream = new MarkupStream("div", null, [
        `I'm a little <teapot> "short" & stout`,
      ]);
      expect(await stream.render()).toBe(
        `<div>I'm a little &lt;teapot&gt; &quot;short&quot; &amp; stout</div>`
      );
    });
  });

  describe("async functionality", () => {
    test("renders async string", async () => {
      const stream = new MarkupStream(null, null, [
        "sync ",
        Promise.resolve("async"),
        " end",
      ]);

      const chunks = await Array.fromAsync(stream.renderChunks());
      // First chunk: content before promise
      // Second chunk: resolved promise + remaining content
      expect(chunks).toEqual(["sync ", "async end"]);
    });

    test("renders async children array", async () => {
      const stream = new MarkupStream(
        "div",
        null,
        Promise.resolve(["Hello ", "World"])
      );

      // The promise is now wrapped as content
      expect(stream.content).not.toBeNull();
      expect(stream.content?.length).toBe(1);
      expect(stream.content?.[0]).toBeInstanceOf(Promise);

      const chunks = await Array.fromAsync(stream.renderChunks());
      // First chunk: opening tag
      // Second chunk: resolved content + closing tag
      expect(chunks).toEqual(["<div>", "Hello World</div>"]);
    });

    test("renders async MarkupStream", async () => {
      const asyncInner = Promise.resolve(
        new MarkupStream("span", null, ["async content"])
      );
      const stream = new MarkupStream("div", null, [
        "before ",
        asyncInner,
        " after",
      ]);

      const chunks = await Array.fromAsync(stream.renderChunks());
      // First chunk: opening tag + content before promise
      // Second chunk: resolved MarkupStream + remaining content
      expect(chunks).toEqual([
        "<div>before ",
        "<span>async content</span> after</div>",
      ]);
    });

    test("renders nested async content", async () => {
      const innerStream = new MarkupStream(
        "span",
        null,
        Promise.resolve(["inner async"])
      );
      const outerStream = new MarkupStream("div", null, [
        "start ",
        innerStream,
        " end",
      ]);

      const chunks = await Array.fromAsync(outerStream.renderChunks());
      // First chunk: everything up to the promise inside the span
      // Second chunk: resolved promise content + remaining
      expect(chunks).toEqual([
        "<div>start <span>",
        "inner async</span> end</div>",
      ]);
    });

    test("handles multiple async items in sequence", async () => {
      const stream = new MarkupStream(null, null, [
        "a",
        Promise.resolve("b"),
        "c",
        Promise.resolve("d"),
        "e",
      ]);

      const result = await stream.render();
      expect(result).toBe("abcde");
    });
  });

  describe("concurrent promise resolution", () => {
    test("renders promises in correct order when second resolves first", async () => {
      const gate = asyncGate(["resolve2", "resolve1"]);
      const checkpoint1 = gate.task("promise1");
      const checkpoint2 = gate.task("promise2");

      const order: string[] = [];

      const promise1 = (async () => {
        await checkpoint1("resolve1");
        order.push("first");
        return "first";
      })();

      const promise2 = (async () => {
        await checkpoint2("resolve2");
        order.push("second");
        return "second";
      })();

      const stream = new MarkupStream("div", null, [
        "start ",
        promise1,
        " middle ",
        promise2,
        " end",
      ]);

      // Start collection in background
      const chunksPromise = (async () => {
        const chunks: string[] = [];
        for await (const chunk of stream.renderChunks()) {
          chunks.push(chunk);
        }
        return chunks;
      })();

      await gate.next(); // resolve second
      await gate.next(); // resolve first

      expect(order).toEqual(["second", "first"]);

      // Get the final result
      const chunks = await chunksPromise;
      expect(chunks.join("")).toBe("<div>start first middle second end</div>");
    });

    test("handles nested streams with out-of-order resolution", async () => {
      const gate = asyncGate(["resolveInner", "resolveOuter"]);
      const checkpointInner = gate.task("inner");
      const checkpointOuter = gate.task("outer");

      const innerPromise = (async () => {
        await checkpointInner("resolveInner");
        return "inner content";
      })();

      const outerPromise = (async () => {
        await checkpointOuter("resolveOuter");
        return new MarkupStream("span", { class: "nested" }, [innerPromise]);
      })();

      const stream = new MarkupStream("div", null, [
        "before ",
        outerPromise,
        " after",
      ]);

      // Start collection in background
      const chunksPromise = (async () => {
        const chunks: string[] = [];
        for await (const chunk of stream.renderChunks()) {
          chunks.push(chunk);
        }
        return chunks;
      })();

      // Resolve inner first (but it's inside outer which isn't resolved yet)
      await gate.next(); // resolveInner
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Now resolve outer
      await gate.next(); // resolveOuter
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Get the final result
      const chunks = await chunksPromise;
      expect(chunks.join("")).toBe(
        '<div>before <span class="nested">inner content</span> after</div>'
      );
    });
  });

  describe("edge cases", () => {
    test("handles deeply nested structures", async () => {
      const deep = new MarkupStream("i", null, ["deep"]);
      const nested = new MarkupStream("b", null, [deep]);
      const stream = new MarkupStream("div", null, [
        "start ",
        new MarkupStream("span", null, [nested]),
        " end",
      ]);

      expect(await stream.render()).toBe(
        "<div>start <span><b><i>deep</i></b></span> end</div>"
      );
    });

    test("handles empty arrays", async () => {
      const stream = new MarkupStream("div", null, [[]]);
      expect(await stream.render()).toBe("<div></div>");
    });

    test("handles promise resolving to null", async () => {
      const stream = new MarkupStream("div", null, [
        "before ",
        Promise.resolve(null),
        " after",
      ]);

      const result = await stream.render();
      expect(result).toBe("<div>before  after</div>");
    });

    test("handles promise resolving to array with mixed content", async () => {
      const stream = new MarkupStream("div", null, [
        Promise.resolve([
          "text",
          42,
          null,
          new MarkupStream("span", null, ["nested"]),
        ] as Content[]),
      ]);

      const result = await stream.render();
      expect(result).toBe("<div>text42<span>nested</span></div>");
    });

    test("handles falsy number 0", async () => {
      const stream = new MarkupStream(null, null, [0, " items"]);
      expect(await stream.render()).toBe("0 items");
    });

    test("handles empty string", async () => {
      const stream = new MarkupStream(null, null, ["", "text", ""]);
      expect(await stream.render()).toBe("text");
    });
  });

  describe("HTML mode (default)", () => {
    test("renders empty tags without closing tag", async () => {
      const br = new MarkupStream("br", null, []);
      expect(await br.render()).toBe("<br>");

      const input = new MarkupStream("input", { type: "text" }, []);
      expect(await input.render()).toBe('<input type="text">');

      const img = new MarkupStream("img", { src: "test.jpg" }, []);
      expect(await img.render()).toBe('<img src="test.jpg">');
    });

    test("renders boolean attributes correctly", async () => {
      const input = new MarkupStream(
        "input",
        {
          type: "checkbox",
          checked: true,
          disabled: false,
          readonly: true,
        },
        []
      );
      expect(await input.render()).toBe(
        '<input type="checkbox" checked readonly>'
      );
    });

    test("renders non-boolean attributes with boolean values as strings", async () => {
      const div = new MarkupStream(
        "div",
        {
          id: false,
          "data-active": true,
          "aria-hidden": false,
        },
        []
      );
      expect(await div.render()).toBe(
        '<div id="false" data-active="true" aria-hidden="false"></div>'
      );
    });

    test("renders empty elements with immediate closing", async () => {
      const div = new MarkupStream("div", null, []);
      expect(await div.render()).toBe("<div></div>");

      const span = new MarkupStream("span", { id: "test" }, []);
      expect(await span.render()).toBe('<span id="test"></span>');
    });
  });

  describe("function content", () => {
    test("renders function returning string", async () => {
      const stream = new MarkupStream("div", null, [
        "before ",
        () => "function result",
        " after",
      ]);
      expect(await stream.render()).toBe(
        "<div>before function result after</div>"
      );
    });

    test("renders function returning MarkupStream", async () => {
      const stream = new MarkupStream("div", null, [
        "text ",
        () => new MarkupStream("span", { id: "lazy" }, ["lazy content"]),
      ]);
      expect(await stream.render()).toBe(
        '<div>text <span id="lazy">lazy content</span></div>'
      );
    });

    test("renders function returning array", async () => {
      const stream = new MarkupStream("div", null, [() => ["a", "b", "c"]]);
      expect(await stream.render()).toBe("<div>abc</div>");
    });

    test("renders function returning null/undefined/boolean", async () => {
      const stream = new MarkupStream("div", null, [
        "start",
        () => null,
        () => undefined,
        () => true,
        () => false,
        "end",
      ]);
      expect(await stream.render()).toBe("<div>startend</div>");
    });

    test("renders nested functions", async () => {
      const stream = new MarkupStream("div", null, [
        () => () => () => "deeply nested",
      ]);
      expect(await stream.render()).toBe("<div>deeply nested</div>");
    });

    test("renders function returning promise", async () => {
      const stream = new MarkupStream("div", null, [
        "before ",
        () => Promise.resolve("async from function"),
        " after",
      ]);
      const result = await stream.render();
      expect(result).toBe("<div>before async from function after</div>");
    });

    test("handles complex edge case: function → promise → function → content", async () => {
      const complexContent = () => Promise.resolve(() => "final content");

      const stream = new MarkupStream("div", null, [
        "before ",
        complexContent,
        " after",
      ]);

      const result = await stream.render();
      expect(result).toBe("<div>before final content after</div>");
    });

    test("handles even more complex: function → promise → function → promise → function", async () => {
      const veryComplex = () =>
        Promise.resolve(() => Promise.resolve(() => "very final"));

      const stream = new MarkupStream("div", null, [
        "start ",
        veryComplex,
        " end",
      ]);

      const result = await stream.render();
      expect(result).toBe("<div>start very final end</div>");
    });

    test("functions are called lazily during rendering", async () => {
      let callCount = 0;
      const trackingFunction = () => {
        callCount++;
        return `called ${callCount} time(s)`;
      };

      const stream = new MarkupStream("div", null, [trackingFunction]);

      // Function shouldn't be called yet
      expect(callCount).toBe(0);

      // Now render, which should call the function
      const result = await stream.render();
      expect(callCount).toBe(1);
      expect(result).toBe("<div>called 1 time(s)</div>");
    });

    test("multiple functions in sequence", async () => {
      let counter = 0;
      const makeFunction = () => () => `${++counter}`;

      const stream = new MarkupStream("div", null, [
        makeFunction(),
        "-",
        makeFunction(),
        "-",
        makeFunction(),
      ]);

      expect(await stream.render()).toBe("<div>1-2-3</div>");
    });
  });

  describe("XML mode", () => {
    test("renders empty elements with self-closing tags", async () => {
      const br = new MarkupStream("br", null, []);
      expect(await br.render({ mode: "xml" })).toBe("<br />");

      const div = new MarkupStream("div", null, []);
      expect(await div.render({ mode: "xml" })).toBe("<div />");

      const input = new MarkupStream("input", { type: "text" }, []);
      expect(await input.render({ mode: "xml" })).toBe('<input type="text" />');
    });

    test("renders all attributes with values", async () => {
      const input = new MarkupStream(
        "input",
        {
          type: "checkbox",
          checked: true,
          disabled: false,
          readonly: true,
        },
        []
      );
      expect(await input.render({ mode: "xml" })).toBe(
        '<input type="checkbox" checked="true" disabled="false" readonly="true" />'
      );
    });

    test("renders elements with content normally", async () => {
      const div = new MarkupStream("div", null, ["content"]);
      expect(await div.render({ mode: "xml" })).toBe("<div>content</div>");

      const span = new MarkupStream("span", { id: "test" }, ["text"]);
      expect(await span.render({ mode: "xml" })).toBe(
        '<span id="test">text</span>'
      );
    });

    test("handles nested empty elements", async () => {
      const outer = new MarkupStream("outer", null, [
        new MarkupStream("inner", null, []),
        new MarkupStream("br", null, []),
      ]);
      expect(await outer.render({ mode: "xml" })).toBe(
        "<outer><inner /><br /></outer>"
      );
    });
  });
});
