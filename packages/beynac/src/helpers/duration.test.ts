import { describe, expect, test } from "bun:test";
import { parseDurationAsFutureDate, parseDurationAsMs } from "./duration";

describe(parseDurationAsMs, () => {
	test("parses 1h as milliseconds", () => {
		expect(parseDurationAsMs("1h")).toBe(60 * 60 * 1000);
	});

	test("parses 5d as milliseconds", () => {
		expect(parseDurationAsMs("5d")).toBe(5 * 24 * 60 * 60 * 1000);
	});

	test("parses 30m as milliseconds", () => {
		expect(parseDurationAsMs("30m")).toBe(30 * 60 * 1000);
	});

	test("parses 10s as milliseconds", () => {
		expect(parseDurationAsMs("10s")).toBe(10 * 1000);
	});

	test("parses 500ms as milliseconds", () => {
		expect(parseDurationAsMs("500ms")).toBe(500);
	});

	test("parses combined 5d4h correctly", () => {
		expect(parseDurationAsMs("5d4h")).toBe((5 * 24 + 4) * 60 * 60 * 1000);
	});

	test("parses combined 1h30m15s correctly", () => {
		expect(parseDurationAsMs("1h30m15s")).toBe((60 * 60 + 30 * 60 + 15) * 1000);
	});

	test("parses 1y as ~365 days in milliseconds", () => {
		expect(parseDurationAsMs("1y")).toBe(365 * 24 * 60 * 60 * 1000);
	});

	test("parses 1w as 7 days in milliseconds", () => {
		expect(parseDurationAsMs("1w")).toBe(7 * 24 * 60 * 60 * 1000);
	});

	test("throws on invalid format", () => {
		expect(() => parseDurationAsMs("xyz")).toThrow(/Invalid duration format/);
	});

	test("throws on empty string", () => {
		expect(() => parseDurationAsMs("")).toThrow(/Duration must be greater than zero/);
	});

	test("handles complex combined format", () => {
		const expected =
			365 * 24 * 60 * 60 * 1000 +
			2 * 7 * 24 * 60 * 60 * 1000 +
			3 * 24 * 60 * 60 * 1000 +
			4 * 60 * 60 * 1000 +
			5 * 60 * 1000 +
			6 * 1000 +
			7;
		expect(parseDurationAsMs("1y2w3d4h5m6s7ms")).toBe(expected);
	});
});

describe(parseDurationAsFutureDate, () => {
	test("Date object passed through unchanged", () => {
		const date = new Date("2025-12-31");
		expect(parseDurationAsFutureDate(date)).toBe(date);
	});

	test("parses 1h as 1 hour from now", () => {
		const result = parseDurationAsFutureDate("1h");
		const expected = Date.now() + 60 * 60 * 1000;
		// Allow 100ms tolerance for test execution time
		expect(Math.abs(result.getTime() - expected)).toBeLessThan(100);
	});

	test("parses 5d as 5 days from now", () => {
		const result = parseDurationAsFutureDate("5d");
		const expected = Date.now() + 5 * 24 * 60 * 60 * 1000;
		expect(Math.abs(result.getTime() - expected)).toBeLessThan(100);
	});

	test("parses 30m as 30 minutes from now", () => {
		const result = parseDurationAsFutureDate("30m");
		const expected = Date.now() + 30 * 60 * 1000;
		expect(Math.abs(result.getTime() - expected)).toBeLessThan(100);
	});

	test("parses 10s as 10 seconds from now", () => {
		const result = parseDurationAsFutureDate("10s");
		const expected = Date.now() + 10 * 1000;
		expect(Math.abs(result.getTime() - expected)).toBeLessThan(100);
	});

	test("parses 500ms as 500 milliseconds from now", () => {
		const result = parseDurationAsFutureDate("500ms");
		const expected = Date.now() + 500;
		expect(Math.abs(result.getTime() - expected)).toBeLessThan(100);
	});

	test("parses combined 5d4h correctly", () => {
		const result = parseDurationAsFutureDate("5d4h");
		const expected = Date.now() + (5 * 24 + 4) * 60 * 60 * 1000;
		expect(Math.abs(result.getTime() - expected)).toBeLessThan(100);
	});

	test("parses combined 1h30m15s correctly", () => {
		const result = parseDurationAsFutureDate("1h30m15s");
		const expected = Date.now() + (60 * 60 + 30 * 60 + 15) * 1000;
		expect(Math.abs(result.getTime() - expected)).toBeLessThan(100);
	});

	test("parses 1y as ~365 days", () => {
		const result = parseDurationAsFutureDate("1y");
		const expected = Date.now() + 365 * 24 * 60 * 60 * 1000;
		expect(Math.abs(result.getTime() - expected)).toBeLessThan(100);
	});

	test("parses 1w as 7 days", () => {
		const result = parseDurationAsFutureDate("1w");
		const expected = Date.now() + 7 * 24 * 60 * 60 * 1000;
		expect(Math.abs(result.getTime() - expected)).toBeLessThan(100);
	});

	test("throws on invalid format", () => {
		expect(() => parseDurationAsFutureDate("xyz")).toThrow(/Invalid duration format/);
	});

	test("throws on empty string", () => {
		expect(() => parseDurationAsFutureDate("")).toThrow(/Duration must be greater than zero/);
	});

	test("handles complex combined format", () => {
		const result = parseDurationAsFutureDate("1y2w3d4h5m6s7ms");
		const expected =
			Date.now() +
			(365 * 24 * 60 * 60 * 1000 +
				2 * 7 * 24 * 60 * 60 * 1000 +
				3 * 24 * 60 * 60 * 1000 +
				4 * 60 * 60 * 1000 +
				5 * 60 * 1000 +
				6 * 1000 +
				7);
		expect(Math.abs(result.getTime() - expected)).toBeLessThan(100);
	});
});
