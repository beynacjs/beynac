import { describe, expect, test } from "bun:test";
import { sha256 } from "./sha";

describe(sha256, () => {
	test("hashes string input", () => {
		const hash = sha256("test");
		expect(hash).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
	});

	test("hashes Uint8Array input", () => {
		const data = new TextEncoder().encode("test");
		const hash = sha256(data);
		expect(hash).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
	});

	test("produces consistent hashes for same input", () => {
		const hash1 = sha256("test");
		const hash2 = sha256("test");
		expect(hash1).toBe(hash2);
	});

	test("handles empty string", () => {
		const hash = sha256("");
		expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	});
});
