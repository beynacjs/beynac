import { describe, expect, test } from "bun:test";
import { scrypt, scryptSync, verifyScrypt, verifyScryptSync } from "./scrypt";

describe(scrypt, () => {
	test("creates a valid PHC-formatted scrypt hash", async () => {
		const hash = await scrypt("password123");
		expect(hash).toMatch(/^\$scrypt\$ln=\d+,r=\d+,p=\d+\$.+\$.+$/);
	});

	test("produces different hashes for same password", async () => {
		const hash1 = await scrypt("password123");
		const hash2 = await scrypt("password123");
		expect(hash1).not.toBe(hash2);
	});

	test("accepts custom parameters", async () => {
		const hash = await scrypt("password123", { N: 1024, r: 4, p: 2 });
		expect(hash).toContain("ln=10,r=4,p=2"); // 2^10 = 1024
	});
});

describe(scryptSync, () => {
	test("creates a valid PHC-formatted scrypt hash", () => {
		const hash = scryptSync("password123");
		expect(hash).toMatch(/^\$scrypt\$ln=\d+,r=\d+,p=\d+\$.+\$.+$/);
	});

	test("produces different hashes for same password", () => {
		const hash1 = scryptSync("password123");
		const hash2 = scryptSync("password123");
		expect(hash1).not.toBe(hash2);
	});
});

describe(verifyScrypt, () => {
	test("verifies correct password", async () => {
		const hash = await scrypt("password123");
		const result = await verifyScrypt("password123", hash);
		expect(result).toBe(true);
	});

	test("rejects incorrect password", async () => {
		const hash = await scrypt("password123");
		const result = await verifyScrypt("wrongpassword", hash);
		expect(result).toBe(false);
	});

	test("handles unicode passwords", async () => {
		const hash = await scrypt("пароль🔒");
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
		const hash = scryptSync("password123");
		const result = verifyScryptSync("password123", hash);
		expect(result).toBe(true);
	});

	test("rejects incorrect password", () => {
		const hash = scryptSync("password123");
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
