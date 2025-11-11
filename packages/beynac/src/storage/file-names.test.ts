import { describe, expect, test } from "bun:test";
import { createFileName, mimeTypeFromFileName, sanitiseName } from "./file-names";

describe(mimeTypeFromFileName, () => {
	test("returns correct MIME type for extensions", () => {
		expect(mimeTypeFromFileName("file.png")).toBe("image/png");
		expect(mimeTypeFromFileName("file.jpg")).toBe("image/jpeg");
		expect(mimeTypeFromFileName("file.css")).toBe("text/css");
		expect(mimeTypeFromFileName("file.json")).toBe("application/json");
	});

	test("is case insensitive", () => {
		expect(mimeTypeFromFileName("file.PNG")).toBe("image/png");
		expect(mimeTypeFromFileName("file.PDF")).toBe("application/pdf");
		expect(mimeTypeFromFileName("FILE.HTML")).toBe("text/html");
	});

	test("returns application/octet-stream for unknown or no extensions", () => {
		expect(mimeTypeFromFileName("file.xyz")).toBe("application/octet-stream");
		expect(mimeTypeFromFileName("file.unknown")).toBe("application/octet-stream");
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
		expect(createFileName("test.txt", "image/png", true)).toBe("test.txt");
	});

	test("when supportsMimeTypes=false and extension is correct, leaves file name unchanged", () => {
		expect(createFileName("test.png", "image/png", false)).toBe("test.png");
		expect(createFileName("test.PNG", "image/png", false)).toBe("test.PNG");
	});

	test("when supportsMimeTypes=false and extension is incorrect, appends correct extension", () => {
		expect(createFileName("test.txt", "image/png", false)).toBe("test.txt.png");
		expect(createFileName("test.TXT", "image/png", false)).toBe("test.TXT.png");
		expect(createFileName("test", "image/png", false)).toBe("test.png");
	});

	test("when MIME type not in known list, doesn't append extension", () => {
		expect(createFileName("test.custom", "application/x-unknown", false)).toBe("test.custom");
	});

	test("preserves valid special chars", () => {
		expect(createFileName("test-file~v2.txt", "text/plain", true)).toBe("test-file~v2.txt");
	});

	test("generates random ID when suggestedName is not provided", () => {
		const allCapsName = /^[A-Z0-9]{20}\.txt$/;
		expect(createFileName(null, "text/plain", true)).toMatch(allCapsName);
		expect(createFileName(undefined, "text/plain", true)).toMatch(allCapsName);
		expect(createFileName("", "text/plain", true)).toMatch(allCapsName);
	});

	test("random IDs are different each time", () => {
		const id1 = createFileName(null, "text/plain", true);
		const id2 = createFileName(null, "text/plain", true);
		expect(id1).not.toBe(id2);
	});

	test("handles MIME types with parameters", () => {
		expect(createFileName("test.html", "text/html; charset=utf-8", false)).toBe("test.html");
		expect(createFileName("test", "text/html; charset=utf-8", false)).toBe("test.html");
		expect(createFileName("test.txt", "text/html; charset=utf-8", false)).toBe("test.txt.html");
	});
});

describe(sanitiseName, () => {
	test("returns name unchanged when no invalid chars", () => {
		expect(sanitiseName("test.txt", "")).toBe("test.txt");
		expect(sanitiseName("my-file_123.pdf", "")).toBe("my-file_123.pdf");
	});

	test("replaces invalid characters with underscore and adds hash", () => {
		expect(sanitiseName("my<file>.txt", "<>")).toMatch(/^my_file_-[0-9a-f]+\.txt$/);
		expect(sanitiseName("test:file", ":")).toMatch(/^test_file-[0-9a-f]+$/);
		expect(sanitiseName("a/b/c", "/")).toMatch(/^a_b_c-[0-9a-f]+$/);
	});

	test("filenames that only differ by invalid characters preserve uniqueness", () => {
		expect(sanitiseName("my<file.txt", "<>")).toBe("my_file-bd7c6d5c.txt");
		expect(sanitiseName("my>file.txt", "<>")).toBe("my_file-155ab680.txt");
	});

	test("replaces multiple invalid characters collapsing consecutive to single underscore", () => {
		expect(sanitiseName("my<file>:test.txt", "<>:")).toMatch(/^my_file_test-[0-9a-f]+\.txt$/);
		expect(sanitiseName("<<>>>", "<>")).toMatch(/^_-[0-9a-f]+$/);
	});

	test("handles special regex characters in invalidChars", () => {
		expect(sanitiseName("test[file].txt", "[]")).toMatch(/^test_file_-[0-9a-f]+\.txt$/);
		expect(sanitiseName("test\\file", "\\")).toMatch(/^test_file-[0-9a-f]+$/);
		expect(sanitiseName("test^file", "^")).toMatch(/^test_file-[0-9a-f]+$/);
		expect(sanitiseName("test-file", "-")).toMatch(/^test_file-[0-9a-f]+$/);
	});

	test("handles Windows invalid chars collapsing consecutive", () => {
		const windowsInvalid = '<>:"/\\|?*';
		expect(sanitiseName('my<file>:"test".txt', windowsInvalid)).toMatch(
			/^my_file_test_-[0-9a-f]+\.txt$/,
		);
	});

	test("works on single names (no path handling)", () => {
		// Slashes are treated as invalid chars if specified
		expect(sanitiseName("file.txt", "/")).toBe("file.txt");
		expect(sanitiseName("path/to/file.txt", "/")).toMatch(/^path_to_file-[0-9a-f]+\.txt$/);
	});
});
