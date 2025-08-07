import { describe, it, test, expect, beforeEach, afterEach, beforeAll, afterAll, mock } from "bun:test";
import type { StringBuffer } from "./html";
import { escapeToBuffer } from "./html";

describe("HTML utilities", () => {
	describe("escapeToBuffer", () => {
		it("Should escape special characters", () => {
			let buffer: StringBuffer = [""];
			escapeToBuffer("I <b>think</b> this is good.", buffer);
			expect(buffer[0]).toBe("I &lt;b&gt;think&lt;/b&gt; this is good.");

			buffer = [""];
			escapeToBuffer('John "Johnny" Smith', buffer);
			expect(buffer[0]).toBe("John &quot;Johnny&quot; Smith");
		});
	});
});
