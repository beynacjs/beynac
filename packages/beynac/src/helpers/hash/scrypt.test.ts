import { describe, expect, test } from "bun:test";
import { hashScrypt, hashScryptSync, hashSha256, verifyScrypt, verifyScryptSync } from "./scrypt";

describe(hashScrypt, () => {
	test("creates a valid PHC-formatted scrypt hash", async () => {
		const hash = await hashScrypt("password123");
		expect(hash).toMatch(/^\$scrypt\$ln=\d+,r=\d+,p=\d+\$.+\$.+$/);
	});

	test("produces different hashes for same password", async () => {
		const hash1 = await hashScrypt("password123");
		const hash2 = await hashScrypt("password123");
		expect(hash1).not.toBe(hash2);
	});

	test("accepts custom parameters", async () => {
		const hash = await hashScrypt("password123", { N: 1024, r: 4, p: 2 });
		expect(hash).toContain("ln=10,r=4,p=2"); // 2^10 = 1024
	});
});

describe(hashScryptSync, () => {
	test("creates a valid PHC-formatted scrypt hash", () => {
		const hash = hashScryptSync("password123");
		expect(hash).toMatch(/^\$scrypt\$ln=\d+,r=\d+,p=\d+\$.+\$.+$/);
	});

	test("produces different hashes for same password", () => {
		const hash1 = hashScryptSync("password123");
		const hash2 = hashScryptSync("password123");
		expect(hash1).not.toBe(hash2);
	});
});

describe(verifyScrypt, () => {
	test("verifies correct password", async () => {
		const hash = await hashScrypt("password123");
		const result = await verifyScrypt("password123", hash);
		expect(result).toBe(true);
	});

	test("rejects incorrect password", async () => {
		const hash = await hashScrypt("password123");
		const result = await verifyScrypt("wrongpassword", hash);
		expect(result).toBe(false);
	});

	test("handles unicode passwords", async () => {
		const hash = await hashScrypt("пароль🔒");
		const result = await verifyScrypt("пароль🔒", hash);
		expect(result).toBe(true);
	});

	test("throws on invalid ln parameter type", () => {
		const invalidHash = "$scrypt$ln=invalid,r=8,p=1$c29tZXNhbHQ$c29tZWhhc2g";
		expect(verifyScrypt("password", invalidHash)).rejects.toThrow(
			"Invalid scrypt hash: ln parameter must be a number",
		);
	});

	test("throws on invalid r parameter type", () => {
		const invalidHash = "$scrypt$ln=14,r=invalid,p=1$c29tZXNhbHQ$c29tZWhhc2g";
		expect(verifyScrypt("password", invalidHash)).rejects.toThrow(
			"Invalid scrypt hash: r parameter must be a number",
		);
	});

	test("throws on invalid p parameter type", () => {
		const invalidHash = "$scrypt$ln=14,r=8,p=invalid$c29tZXNhbHQ$c29tZWhhc2g";
		expect(verifyScrypt("password", invalidHash)).rejects.toThrow(
			"Invalid scrypt hash: p parameter must be a number",
		);
	});
});

describe(verifyScryptSync, () => {
	test("verifies correct password", () => {
		const hash = hashScryptSync("password123");
		const result = verifyScryptSync("password123", hash);
		expect(result).toBe(true);
	});

	test("rejects incorrect password", () => {
		const hash = hashScryptSync("password123");
		const result = verifyScryptSync("wrongpassword", hash);
		expect(result).toBe(false);
	});

	test("throws on invalid ln parameter type", () => {
		const invalidHash = "$scrypt$ln=invalid,r=8,p=1$c29tZXNhbHQ$c29tZWhhc2g";
		expect(() => verifyScryptSync("password", invalidHash)).toThrow(
			"Invalid scrypt hash: ln parameter must be a number",
		);
	});

	test("throws on invalid r parameter type", () => {
		const invalidHash = "$scrypt$ln=14,r=invalid,p=1$c29tZXNhbHQ$c29tZWhhc2g";
		expect(() => verifyScryptSync("password", invalidHash)).toThrow(
			"Invalid scrypt hash: r parameter must be a number",
		);
	});

	test("throws on invalid p parameter type", () => {
		const invalidHash = "$scrypt$ln=14,r=8,p=invalid$c29tZXNhbHQ$c29tZWhhc2g";
		expect(() => verifyScryptSync("password", invalidHash)).toThrow(
			"Invalid scrypt hash: p parameter must be a number",
		);
	});
});

describe(hashSha256, () => {
	test("hashes string input", async () => {
		const hash = await hashSha256("test");
		expect(hash).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
	});

	test("hashes Uint8Array input", async () => {
		const data = new TextEncoder().encode("test");
		const hash = await hashSha256(data);
		expect(hash).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
	});

	test("produces consistent hashes for same input", async () => {
		const hash1 = await hashSha256("test");
		const hash2 = await hashSha256("test");
		expect(hash1).toBe(hash2);
	});

	test("handles empty string", async () => {
		const hash = await hashSha256("");
		expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	});
});
