import { describe, expect, test } from "bun:test";
import { type Chunk, type Content, MarkupStream } from "./markup-stream";
import { asyncGate } from "./test-utils/async-gate";

// Helper to collect all chunks from async rendering
async function collectChunks(initial: Chunk): Promise<string> {
	const chunks: string[] = [];
	let current = initial;

	while (current[1] !== null) {
		chunks.push(current[0]);
		current = await current[1];
	}
	chunks.push(current[0]);

	return chunks.join("");
}

describe("MarkupStream", () => {
	describe("basic functionality", () => {
		test("renders empty content", () => {
			// Test both null content and tags with no children
			const emptyStream = new MarkupStream(null, null, null);
			expect(emptyStream.renderChunks()).toEqual(["", null]);

			const emptyTag = new MarkupStream("br", null, null);
			expect(emptyTag.renderChunks()).toEqual(["<br></br>", null]);
		});

		test("renders text content", () => {
			// Without tag
			const plainText = new MarkupStream(null, null, ["Hello World"]);
			expect(plainText.renderChunks()).toEqual(["Hello World", null]);

			// With tag
			const taggedText = new MarkupStream("div", null, ["Hello"]);
			expect(taggedText.renderChunks()).toEqual(["<div>Hello</div>", null]);
		});

		test("renders tag with attributes", () => {
			const stream = new MarkupStream(
				"div",
				{ id: "test", class: "container" },
				["Content"],
			);
			const [content, promise] = stream.renderChunks();
			expect(content).toBe('<div id="test" class="container">Content</div>');
			expect(promise).toBeNull();
		});

		test("renders numbers", () => {
			const stream = new MarkupStream(null, null, [42, " is the answer"]);
			const [content, promise] = stream.renderChunks();
			expect(content).toBe("42 is the answer");
			expect(promise).toBeNull();
		});

		test("skips null, undefined, and boolean values", () => {
			const stream = new MarkupStream(null, null, [
				"start",
				null,
				undefined,
				true,
				false,
				"end",
			]);
			const [content, promise] = stream.renderChunks();
			expect(content).toBe("startend");
			expect(promise).toBeNull();
		});

		test("renders nested arrays", () => {
			const stream = new MarkupStream(null, null, [
				"a",
				["b", ["c", "d"], "e"],
				"f",
			]);
			const [content, promise] = stream.renderChunks();
			expect(content).toBe("abcdef");
			expect(promise).toBeNull();
		});

		test("renders arrays with mixed async content", async () => {
			const stream = new MarkupStream(null, null, [
				["a", Promise.resolve("b")],
				[Promise.resolve(["c", "d"] as Content[])],
			]);

			const result = await collectChunks(stream.renderChunks());
			expect(result).toBe("abcd");
		});

		test("renders empty arrays at various nesting levels", () => {
			const stream = new MarkupStream(null, null, [
				"a",
				[],
				["b", [], "c"],
				[[], [[]]],
				"d",
			]);
			const [content, promise] = stream.renderChunks();
			expect(content).toBe("abcd");
			expect(promise).toBeNull();
		});

		test("renders arrays with all skippable values", () => {
			const stream = new MarkupStream(null, null, [
				"start",
				[null, undefined, true, false],
				[[null], [undefined, [true, false]]],
				"end",
			]);
			const [content, promise] = stream.renderChunks();
			expect(content).toBe("startend");
			expect(promise).toBeNull();
		});

		test("renders promises resolving to nested arrays", async () => {
			const stream = new MarkupStream(null, null, [
				"before ",
				Promise.resolve(["a", ["b", "c"]] as Content[]),
				" after",
			]);

			const [chunk1, promise1] = stream.renderChunks();
			expect(chunk1).toBe("before ");
			expect(promise1).not.toBeNull();

			const [chunk2, promise2] = await promise1!;
			expect(chunk2).toBe("abc after");
			expect(promise2).toBeNull();
		});

		test("renders nested MarkupStreams", () => {
			const inner = new MarkupStream("span", { id: "inner" }, ["inner"]);
			const outer = new MarkupStream("div", { id: "outer" }, [
				"before ",
				inner,
				" after",
			]);
			const [content, promise] = outer.renderChunks();
			expect(content).toBe(
				'<div id="outer">before <span id="inner">inner</span> after</div>',
			);
			expect(promise).toBeNull();
		});
	});

	describe("attribute handling", () => {
		test("handles boolean attributes", () => {
			const stream = new MarkupStream(
				"input",
				{ disabled: true, hidden: false, checked: true },
				[],
			);
			const [content] = stream.renderChunks();
			expect(content).toBe("<input disabled checked></input>");
		});

		test("skips null, undefined, and function attributes", () => {
			const stream = new MarkupStream(
				"div",
				{
					id: "test",
					nullAttr: null,
					undefinedAttr: undefined,
					funcAttr: () => {},
				},
				[],
			);
			const [content] = stream.renderChunks();
			expect(content).toBe('<div id="test"></div>');
		});

		test("escapes attribute values", () => {
			const stream = new MarkupStream(
				"div",
				{
					title: 'Test "quotes" & <brackets>',
					"data-value": "It's a test",
				},
				[],
			);
			const [content] = stream.renderChunks();
			expect(content).toBe(
				'<div title="Test &quot;quotes&quot; &amp; &lt;brackets&gt;" data-value="It\'s a test"></div>',
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

			const [chunk1, promise1] = stream.renderChunks();
			expect(chunk1).toBe("sync ");
			expect(promise1).not.toBeNull();

			const [chunk2, promise2] = await promise1!;
			expect(chunk2).toBe("async end");
			expect(promise2).toBeNull();
		});

		test("renders async children array", async () => {
			const stream = new MarkupStream(
				"div",
				null,
				Promise.resolve(["Hello ", "World"]),
			);

			// The promise is now wrapped as content
			expect(stream.content).not.toBeNull();
			expect(stream.content!.length).toBe(1);
			expect(stream.content![0]).toBeInstanceOf(Promise);

			const [chunk1, promise1] = stream.renderChunks();
			expect(chunk1).toBe("<div>");
			expect(promise1).not.toBeNull();

			const [chunk2, promise2] = await promise1!;
			expect(chunk2).toBe("Hello World</div>");
			expect(promise2).toBeNull();
		});

		test("renders async MarkupStream", async () => {
			const asyncInner = Promise.resolve(
				new MarkupStream("span", null, ["async content"]),
			);
			const stream = new MarkupStream("div", null, [
				"before ",
				asyncInner,
				" after",
			]);

			const [chunk1, promise1] = stream.renderChunks();
			expect(chunk1).toBe("<div>before ");
			expect(promise1).not.toBeNull();

			const [chunk2, promise2] = await promise1!;
			expect(chunk2).toBe("<span>async content</span> after</div>");
			expect(promise2).toBeNull();
		});

		test("renders nested async content", async () => {
			const innerStream = new MarkupStream(
				"span",
				null,
				Promise.resolve(["inner async"]),
			);
			const outerStream = new MarkupStream("div", null, [
				"start ",
				innerStream,
				" end",
			]);

			const [chunk1, promise1] = outerStream.renderChunks();
			// Now the span tag is rendered immediately since it's just a regular MarkupStream
			expect(chunk1).toBe("<div>start <span>");
			expect(promise1).not.toBeNull();

			const [chunk2, promise2] = await promise1!;
			expect(chunk2).toBe("inner async</span> end</div>");
			expect(promise2).toBeNull();
		});

		test("handles multiple async items in sequence", async () => {
			const stream = new MarkupStream(null, null, [
				"a",
				Promise.resolve("b"),
				"c",
				Promise.resolve("d"),
				"e",
			]);

			const result = await collectChunks(stream.renderChunks());
			expect(result).toBe("abcde");
		});
	});

	describe("concurrent promise resolution", () => {
		test("renders promises in correct order when second resolves first", async () => {
			const gate = asyncGate(["start", "resolve2", "resolve1", "done"]);
			const checkpoint1 = gate.task("promise1");
			const checkpoint2 = gate.task("promise2");

			let resolver1: (value: string) => void;
			let resolver2: (value: string) => void;

			const promise1 = new Promise<string>((resolve) => {
				resolver1 = resolve;
			});

			const promise2 = new Promise<string>((resolve) => {
				resolver2 = resolve;
			});

			const promise1Task = async () => {
				await checkpoint1("start");
				await checkpoint1("resolve1");
				resolver1!("first");
				await checkpoint1("done");
			};

			const promise2Task = async () => {
				await checkpoint2("start");
				await checkpoint2("resolve2");
				resolver2!("second");
				await checkpoint2("done");
			};

			const stream = new MarkupStream("div", null, [
				"start ",
				promise1,
				" middle ",
				promise2,
				" end",
			]);

			const testTask = async () => {
				await gate.next(); // start

				const [chunk1, promise1Chunk] = stream.renderChunks();
				expect(chunk1).toBe("<div>start ");
				expect(promise1Chunk).not.toBeNull();

				// Resolve second promise first
				await gate.next(); // resolve2
				await new Promise((resolve) => setTimeout(resolve, 10));

				// First promise still pending, so we wait
				await gate.next(); // resolve1
				await new Promise((resolve) => setTimeout(resolve, 10));

				// Now we should get both in correct order
				const [chunk2, promise2Chunk] = await promise1Chunk!;
				expect(chunk2).toBe("first middle ");
				expect(promise2Chunk).not.toBeNull();

				const [chunk3, promise3Chunk] = await promise2Chunk!;
				expect(chunk3).toBe("second end</div>");
				expect(promise3Chunk).toBeNull();

				await gate.next(); // done
			};

			await Promise.all([promise1Task(), promise2Task(), testTask()]);
		});

		test("handles nested streams with out-of-order resolution", async () => {
			const gate = asyncGate(["start", "resolveInner", "resolveOuter", "done"]);
			const checkpointInner = gate.task("inner");
			const checkpointOuter = gate.task("outer");

			let resolverInner: (value: string) => void;
			let resolverOuter: (value: MarkupStream) => void;

			const innerPromise = new Promise<string>((resolve) => {
				resolverInner = resolve;
			});

			const outerPromise = new Promise<MarkupStream>((resolve) => {
				resolverOuter = resolve;
			});

			const innerTask = async () => {
				await checkpointInner("start");
				await checkpointInner("resolveInner");
				resolverInner!("inner content");
				await checkpointInner("done");
			};

			const outerTask = async () => {
				await checkpointOuter("start");
				await checkpointOuter("resolveOuter");
				resolverOuter!(
					new MarkupStream("span", { class: "nested" }, [innerPromise]),
				);
				await checkpointOuter("done");
			};

			const stream = new MarkupStream("div", null, [
				"before ",
				outerPromise,
				" after",
			]);

			const testTask = async () => {
				await gate.next(); // start

				const [chunk1, promise1] = stream.renderChunks();
				expect(chunk1).toBe("<div>before ");

				// Resolve inner first (but it's inside outer which isn't resolved yet)
				await gate.next(); // resolveInner
				await new Promise((resolve) => setTimeout(resolve, 10));

				// Now resolve outer
				await gate.next(); // resolveOuter
				await new Promise((resolve) => setTimeout(resolve, 10));

				// Should get the outer stream structure
				const [chunk2, promise2] = await promise1!;
				expect(chunk2).toBe('<span class="nested">');
				expect(promise2).not.toBeNull();

				// And then the inner content
				const [chunk3, promise3] = await promise2!;
				expect(chunk3).toBe("inner content</span> after</div>");
				expect(promise3).toBeNull();

				await gate.next(); // done
			};

			await Promise.all([innerTask(), outerTask(), testTask()]);
		});
	});

	describe("edge cases", () => {
		test("handles deeply nested structures", () => {
			const deep = new MarkupStream("i", null, ["deep"]);
			const nested = new MarkupStream("b", null, [deep]);
			const stream = new MarkupStream("div", null, [
				"start ",
				new MarkupStream("span", null, [nested]),
				" end",
			]);

			const [content, promise] = stream.renderChunks();
			expect(content).toBe(
				"<div>start <span><b><i>deep</i></b></span> end</div>",
			);
			expect(promise).toBeNull();
		});

		test("handles empty arrays", () => {
			const stream = new MarkupStream("div", null, [[]]);
			const [content, promise] = stream.renderChunks();
			expect(content).toBe("<div></div>");
			expect(promise).toBeNull();
		});

		test("handles promise resolving to null", async () => {
			const stream = new MarkupStream("div", null, [
				"before ",
				Promise.resolve(null),
				" after",
			]);

			const [chunk1, promise1] = stream.renderChunks();
			expect(chunk1).toBe("<div>before ");

			const [chunk2, promise2] = await promise1!;
			expect(chunk2).toBe(" after</div>");
			expect(promise2).toBeNull();
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

			const [chunk1, promise1] = stream.renderChunks();
			expect(chunk1).toBe("<div>");

			const [chunk2, promise2] = await promise1!;
			expect(chunk2).toBe("text42<span>nested</span></div>");
			expect(promise2).toBeNull();
		});

		test("handles falsy number 0", () => {
			const stream = new MarkupStream(null, null, [0, " items"]);
			const [content, promise] = stream.renderChunks();
			expect(content).toBe("0 items");
			expect(promise).toBeNull();
		});

		test("handles empty string", () => {
			const stream = new MarkupStream(null, null, ["", "text", ""]);
			const [content, promise] = stream.renderChunks();
			expect(content).toBe("text");
			expect(promise).toBeNull();
		});
	});
});
