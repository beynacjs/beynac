import { beforeEach, describe, expect, test } from "bun:test";
import { asyncGate } from "../test-utils/async-gate";
import { AsyncBuffer } from "./async-buffer";

describe("AsyncBuffer", () => {
	let buffer: AsyncBuffer;

	beforeEach(() => {
		buffer = new AsyncBuffer();
	});

	describe("basic functionality", () => {
		test("empty buffer is resolved empty string", () => {
			expect(buffer.resolved).toBe(true);
			expect(buffer.get()).toBe("");
		});

		test("append single string", () => {
			buffer.append("hello");
			expect(buffer.resolved).toBe(true);
			expect(buffer.get()).toBe("hello");
		});

		test("append multiple strings", () => {
			buffer.append("hello");
			buffer.append(" ");
			buffer.append("world");
			expect(buffer.resolved).toBe(true);
			expect(buffer.get()).toBe("hello world");
		});

		test("append resolved promise", async () => {
			buffer.append(Promise.resolve("hello"));
			expect(buffer.resolved).toBe(false);
			const result = await buffer.get();
			expect(result).toBe("hello");
		});

		test("append string after promise", async () => {
			buffer.append(Promise.resolve("hello"));
			buffer.append(" world");
			expect(buffer.resolved).toBe(false);
			const result = await buffer.get();
			expect(result).toBe("hello world");
		});

		test("append promise after string", async () => {
			buffer.append("hello ");
			buffer.append(Promise.resolve("world"));
			expect(buffer.resolved).toBe(false);
			const result = await buffer.get();
			expect(result).toBe("hello world");
		});

		test("mixed strings and promises", async () => {
			buffer.append("a");
			buffer.append(Promise.resolve("b"));
			buffer.append("c");
			buffer.append(Promise.resolve("d"));
			buffer.append("e");

			expect(buffer.resolved).toBe(false);
			const result = await buffer.get();
			expect(result).toBe("abcde");
		});
	});

	describe("async behavior with asyncGate", () => {
		test("promise resolution updates resolved state", async () => {
			const gate = asyncGate(["start", "resolve", "check", "done"]);
			const checkpoint = gate.task("promise");

			let resolver: (value: string) => void;
			const promise = new Promise<string>((resolve) => {
				resolver = resolve;
			});

			const promiseTask = async () => {
				await checkpoint("start");
				await checkpoint("resolve");
				resolver!("hello");
				await checkpoint("check");
				await checkpoint("done");
			};

			const testTask = async () => {
				await gate.next(); // start
				buffer.append(promise);
				expect(buffer.resolved).toBe(false);

				await gate.next(); // resolve
				// Give microtask queue a chance to process
				await new Promise((resolve) => setTimeout(resolve, 0));

				await gate.next(); // check
				expect(buffer.resolved).toBe(true);
				expect(buffer.get()).toBe("hello");

				await gate.next(); // done
			};

			await Promise.all([promiseTask(), testTask()]);
		});

		test("concurrent appends maintain order", async () => {
			const gate = asyncGate([
				"start",
				"append1",
				"append2",
				"resolve1",
				"resolve2",
				"done",
			]);
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
				await checkpoint1("append1");
				await checkpoint1("resolve1");
				resolver1!("first");
				await checkpoint1("done");
			};

			const promise2Task = async () => {
				await checkpoint2("start");
				await checkpoint2("append2");
				await checkpoint2("resolve2");
				resolver2!("second");
				await checkpoint2("done");
			};

			const testTask = async () => {
				await gate.next(); // start

				await gate.next(); // append1
				buffer.append(promise1);

				await gate.next(); // append2
				buffer.append(promise2);

				expect(buffer.resolved).toBe(false);

				// Resolve out of order
				await gate.next(); // resolve2
				await new Promise((resolve) => setTimeout(resolve, 0));
				expect(buffer.resolved).toBe(false);

				await gate.next(); // resolve1
				await new Promise((resolve) => setTimeout(resolve, 0));
				expect(buffer.resolved).toBe(true);

				expect(buffer.get()).toBe("firstsecond");

				await gate.next(); // done
			};

			await Promise.all([promise1Task(), promise2Task(), testTask()]);
		});

		test("get() waits for all promises", async () => {
			const gate = asyncGate([
				"start",
				"append",
				"getStart",
				"resolve",
				"getEnd",
				"done",
			]);
			const checkpoint = gate.task("promise");

			let resolver: (value: string) => void;
			const promise = new Promise<string>((resolve) => {
				resolver = resolve;
			});

			const promiseTask = async () => {
				await checkpoint("start");
				await checkpoint("append");
				await checkpoint("resolve");
				resolver!("async");
				await checkpoint("done");
			};

			let getPromise: Promise<string>;
			let getResult: string | undefined;

			const testTask = async () => {
				await gate.next(); // start

				await gate.next(); // append
				buffer.append("sync");
				buffer.append(promise);

				await gate.next(); // getStart
				getPromise = buffer.get() as Promise<string>;
				expect(getPromise).toBeInstanceOf(Promise);

				// Set up resolution handler
				getPromise.then((result) => {
					getResult = result;
				});

				await gate.next(); // resolve
				await new Promise((resolve) => setTimeout(resolve, 10));

				await gate.next(); // getEnd
				expect(getResult).toBe("syncasync");

				await gate.next(); // done
			};

			await Promise.all([promiseTask(), testTask()]);
		});
	});

	describe("error handling", () => {
		test("rejected promise in buffer throws on get", async () => {
			buffer.append(Promise.reject(new Error("test error")));
			await expect(buffer.get()).rejects.toThrow("test error");
		});

		test("rejected promise with non-Error throws wrapped error", async () => {
			buffer.append(Promise.reject("string error"));
			try {
				await buffer.get();
				throw "shouldn't get here";
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toBe("string error");
			}
		});

		test("error after successful content", async () => {
			buffer.append("success");
			buffer.append(Promise.reject(new Error("failure")));
			await expect(buffer.get()).rejects.toThrow("failure");
		});

		test("content after error is not accessible via get", async () => {
			buffer.append(Promise.reject(new Error("failure")));
			buffer.append("never seen");
			await expect(buffer.get()).rejects.toThrow("failure");
		});

		test("multiple errors throws first error", async () => {
			buffer.append(Promise.reject(new Error("error1")));
			buffer.append(Promise.reject(new Error("error2")));
			await expect(buffer.get()).rejects.toThrow("error1");
		});
	});

	describe("getChunks async generator", () => {
		test("yields empty string for empty buffer", async () => {
			const chunks: string[] = [];
			for await (const chunk of buffer.getChunks()) {
				chunks.push(chunk);
			}
			expect(chunks).toEqual([""]);
		});

		test("yields single string", async () => {
			buffer.append("hello");
			const chunks: string[] = [];
			for await (const chunk of buffer.getChunks()) {
				chunks.push(chunk);
			}
			expect(chunks).toEqual(["hello"]);
		});

		test("yields multiple strings in order", async () => {
			buffer.append("hello");
			buffer.append(" ");
			buffer.append("world");
			const chunks: string[] = [];
			for await (const chunk of buffer.getChunks()) {
				chunks.push(chunk);
			}
			expect(chunks).toEqual(["hello world"]);
		});

		test("yields resolved promises", async () => {
			buffer.append("a");
			buffer.append(Promise.resolve("b"));
			buffer.append("c");

			const chunks: string[] = [];
			for await (const chunk of buffer.getChunks()) {
				chunks.push(chunk);
			}
			expect(chunks).toEqual(["a", "b", "c"]);
		});

		test("waits for unresolved promises", async () => {
			const gate = asyncGate(["start", "append", "iterate", "resolve", "done"]);
			const checkpoint = gate.task("promise");

			let resolver: (value: string) => void;
			const promise = new Promise<string>((resolve) => {
				resolver = resolve;
			});

			const promiseTask = async () => {
				await checkpoint("start");
				await checkpoint("append");
				await checkpoint("resolve");
				resolver!("delayed");
				await checkpoint("done");
			};

			const chunks: string[] = [];
			let iteratorDone = false;

			const testTask = async () => {
				await gate.next(); // start

				await gate.next(); // append
				buffer.append("immediate");
				buffer.append(promise);
				buffer.append("after");

				await gate.next(); // iterate
				const iterator = buffer.getChunks();

				// First chunk should be immediate
				const first = await iterator.next();
				expect(first.value).toBe("immediate");
				chunks.push(first.value!);

				// Second chunk should wait for promise
				const secondPromise = iterator.next();

				await gate.next(); // resolve
				const second = await secondPromise;
				expect(second.value).toBe("delayed");
				chunks.push(second.value!);

				// Third chunk
				const third = await iterator.next();
				expect(third.value).toBe("after");
				chunks.push(third.value!);

				// Done
				const done = await iterator.next();
				expect(done.done).toBe(true);
				iteratorDone = true;

				await gate.next(); // done
			};

			await Promise.all([promiseTask(), testTask()]);
			expect(chunks).toEqual(["immediate", "delayed", "after"]);
			expect(iteratorDone).toBe(true);
		});

		test("throws on rejected promise", async () => {
			buffer.append("before");
			buffer.append(Promise.reject(new Error("chunk error")));
			buffer.append("after");

			const chunks: string[] = [];
			await expect(
				(async () => {
					for await (const chunk of buffer.getChunks()) {
						chunks.push(chunk);
					}
				})(),
			).rejects.toThrow("chunk error");

			expect(chunks).toEqual(["before"]); // Only got first chunk
		});
		test("multiple iterators can run concurrently", async () => {
			buffer.append("a");
			buffer.append(Promise.resolve("b"));
			buffer.append("c");

			const chunks1: string[] = [];
			const chunks2: string[] = [];

			await Promise.all([
				(async () => {
					for await (const chunk of buffer.getChunks()) {
						chunks1.push(chunk);
					}
				})(),
				(async () => {
					for await (const chunk of buffer.getChunks()) {
						chunks2.push(chunk);
					}
				})(),
			]);

			expect(chunks1).toEqual(["a", "b", "c"]);
			expect(chunks2).toEqual(["a", "b", "c"]);
		});
	});

	describe("edge cases", () => {
		test("empty string appends", () => {
			buffer.append("");
			buffer.append("a");
			buffer.append("");
			expect(buffer.get()).toBe("a");
		});

		test("promise resolving to empty string", async () => {
			buffer.append(Promise.resolve(""));
			buffer.append("a");
			const result = await buffer.get();
			expect(result).toBe("a");
		});

		test("many alternating strings and promises", async () => {
			const promises: Promise<string>[] = [];
			for (let i = 0; i < 10; i++) {
				buffer.append(`s${i}`);
				const promise = Promise.resolve(`p${i}`);
				promises.push(promise);
				buffer.append(promise);
			}

			const result = await buffer.get();
			expect(result).toBe("s0p0s1p1s2p2s3p3s4p4s5p5s6p6s7p7s8p8s9p9");
		});

		test("already resolved promises", async () => {
			const resolved = Promise.resolve("resolved");
			await resolved; // Ensure it's resolved

			buffer.append(resolved);
			buffer.append("after");

			// Even though promise is resolved, buffer should still be unresolved initially
			expect(buffer.resolved).toBe(false);

			// But should resolve quickly
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(buffer.resolved).toBe(true);
			expect(buffer.get()).toBe("resolvedafter");
		});
	});
});
