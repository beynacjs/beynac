import { describe, expect, test } from "bun:test";
import { createFileName, mimeTypeFromFileName } from "./file-names";

describe(mimeTypeFromFileName, () => {
	test("returns correct MIME type for primary list extensions", () => {
		expect(mimeTypeFromFileName("file.png")).toBe("image/png");
		expect(mimeTypeFromFileName("file.jpg")).toBe("image/jpeg");
		expect(mimeTypeFromFileName("file.webm")).toBe("video/webm");
		expect(mimeTypeFromFileName("file.mp4")).toBe("video/mp4");
		expect(mimeTypeFromFileName("file.pdf")).toBe("application/pdf");
	});

	test("returns correct MIME type for secondary list extensions", () => {
		expect(mimeTypeFromFileName("file.ico")).toBe("image/x-icon");
		expect(mimeTypeFromFileName("file.html")).toBe("text/html");
		expect(mimeTypeFromFileName("file.css")).toBe("text/css");
		expect(mimeTypeFromFileName("file.json")).toBe("application/json");
	});

	test("is case insensitive", () => {
		expect(mimeTypeFromFileName("file.PNG")).toBe("image/png");
		expect(mimeTypeFromFileName("file.PDF")).toBe("application/pdf");
		expect(mimeTypeFromFileName("FILE.HTML")).toBe("text/html");
	});

	test("returns application/octet-stream for unknown extensions", () => {
		expect(mimeTypeFromFileName("file.xyz")).toBe("application/octet-stream");
		expect(mimeTypeFromFileName("file.unknown")).toBe("application/octet-stream");
	});

	test("handles files with no extension", () => {
		expect(mimeTypeFromFileName("README")).toBe("application/octet-stream");
		expect(mimeTypeFromFileName("Makefile")).toBe("application/octet-stream");
	});

	test("extracts extension from full path", () => {
		expect(mimeTypeFromFileName("path/to/file.png")).toBe("image/png");
		expect(mimeTypeFromFileName("/absolute/path/document.pdf")).toBe("application/pdf");
	});

	test("handles multiple dots in filename", () => {
		expect(mimeTypeFromFileName("archive.tar.gz")).toBe("application/x-gzip");
		expect(mimeTypeFromFileName("component.test.js")).toBe("text/javascript");
	});
});

describe(createFileName, () => {
	test("when supportsMimeTypes=true, preserves name unchanged", () => {
		const result = createFileName("test.txt", "image/png", true, /(?!)/);
		expect(result).toBe("test.txt");
	});

	test("when supportsMimeTypes=false and extension matches primary MIME, preserves name", () => {
		const result = createFileName("test.png", "image/png", false, /(?!)/);
		expect(result).toBe("test.png");
	});

	test("when supportsMimeTypes=false and extension mismatches primary MIME, adjusts extension", () => {
		const result = createFileName("test.txt", "image/png", false, /(?!)/);
		expect(result).toBe("test.png");
	});

	test("when supportsMimeTypes=false and no extension, adds primary extension", () => {
		const result = createFileName("test", "image/png", false, /(?!)/);
		expect(result).toBe("test.png");
	});

	test("when MIME type not in primary list, doesn't enforce extension", () => {
		const result = createFileName("test.custom", "application/x-unknown", false, /(?!)/);
		expect(result).toBe("test.custom");
	});

	test("replaces invalid chars with underscores", () => {
		const result = createFileName("test<file>.txt", "text/plain", true, /[<>]/g);
		expect(result).toBe("test_file_.txt");
	});

	test("handles multiple invalid chars in one name", () => {
		const result = createFileName("test:file*name.txt", "text/plain", true, /[:*]/g);
		expect(result).toBe("test_file_name.txt");
	});

	test("preserves valid special chars", () => {
		const result = createFileName("test-file_v2.txt", "text/plain", true, /(?!)/);
		expect(result).toBe("test-file_v2.txt");
	});

	test("throws error when name is empty string", () => {
		expect(() => createFileName("", "text/plain", true, /(?!)/)).toThrow(
			"Filename is empty after sanitization",
		);
	});

	test("handles name with only invalid chars by replacing with underscores", () => {
		const result = createFileName("***", "text/plain", true, /[*]/g);
		expect(result).toBe("___");
	});

	test("generates random ID when suggestedName is null", () => {
		const result = createFileName(null, "text/plain", true, /(?!)/);
		expect(result).toMatch(/^[a-zA-Z0-9]{20}$/);
	});

	test("generates random ID when suggestedName is undefined", () => {
		const result = createFileName(undefined, "text/plain", true, /(?!)/);
		expect(result).toMatch(/^[a-zA-Z0-9]{20}$/);
	});

	test("appends extension to random ID when supportsMimeTypes=false", () => {
		const result = createFileName(null, "image/png", false, /(?!)/);
		expect(result).toMatch(/^[a-zA-Z0-9]{20}\.png$/);
	});

	test("random IDs are different each time", () => {
		const id1 = createFileName(null, "text/plain", true, /(?!)/);
		const id2 = createFileName(null, "text/plain", true, /(?!)/);
		expect(id1).not.toBe(id2);
	});

	test("handles MIME types with parameters", () => {
		const result = createFileName("test.html", "text/html; charset=utf-8", false, /(?!)/);
		expect(result).toBe("test.html");
	});

	test("case insensitive extension matching", () => {
		const result = createFileName("test.PNG", "image/png", false, /(?!)/);
		expect(result).toBe("test.PNG");
	});

	test("replaces mismatched extension case-insensitively", () => {
		const result = createFileName("test.TXT", "image/png", false, /(?!)/);
		expect(result).toBe("test.png");
	});

	test("handles edge case of only invalid chars in generated name", () => {
		// Even with sanitization, random IDs should be alphanumeric and safe
		const result = createFileName(null, "text/plain", true, /[<>]/g);
		expect(result).toMatch(/^[a-zA-Z0-9]{20}$/);
	});
});
