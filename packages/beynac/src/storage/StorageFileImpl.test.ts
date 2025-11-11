import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { StorageEndpoint } from "../contracts/Storage";
import { mockCurrentTime, resetTimeMocks } from "../helpers/time";
import { expectErrorWithProperties, spyOnAll } from "../test-utils";
import { memoryStorage } from "./drivers/memory/MemoryStorageDriver";
import { StorageDiskImpl } from "./StorageDiskImpl";
import { StorageFileImpl } from "./StorageFileImpl";
import { InvalidPathError, NotFoundError } from "./storage-errors";

describe(StorageFileImpl, () => {
	let endpoint: StorageEndpoint;
	let disk: StorageDiskImpl;

	beforeEach(() => {
		mockCurrentTime(new Date("2025-01-01T00:00:00Z"));
		endpoint = memoryStorage({});
		disk = new StorageDiskImpl("test", endpoint);
	});

	afterEach(() => {
		resetTimeMocks();
	});

	describe("constructor", () => {
		test("stores path", () => {
			const file = new StorageFileImpl(disk, endpoint, "/path/to/file.txt");
			expect(file.path).toBe("/path/to/file.txt");
		});

		test("throws when path does not start with a slash", () => {
			expect(() => new StorageFileImpl(disk, endpoint, "")).toThrowError(InvalidPathError);
			expect(() => new StorageFileImpl(disk, endpoint, "foo.txt")).toThrowError(InvalidPathError);

			expectErrorWithProperties(
				() => new StorageFileImpl(disk, endpoint, "foo.txt"),
				InvalidPathError,
				{
					path: "foo.txt",
					reason: "must start with a slash",
				},
			);
		});
	});

	describe("delete()", () => {
		test("deletes file from storage", async () => {
			const file = disk.file("test.txt");
			await file.put({ data: "content", mimeType: "text/plain" });
			expect(await file.exists()).toBe(true);
			await file.delete();
			expect(await file.exists()).toBe(false);
		});
	});

	describe("exists()", () => {
		test("returns false when file doesn't exist", async () => {
			const file = disk.file("test.txt");
			expect(await file.exists()).toBe(false);
		});

		test("returns true when file exists", async () => {
			const file = disk.file("test.txt");
			await file.put({ data: "content", mimeType: "text/plain" });
			expect(await file.exists()).toBe(true);
		});
	});

	describe("fetch()", () => {
		test("returns file content", async () => {
			const file = disk.file("test.txt");
			await file.put({ data: "content", mimeType: "text/plain" });
			const response = await file.fetch();
			expect(await response.text()).toBe("content");
		});

		test("throws when file doesn't exist", async () => {
			const file = disk.file("nonexistent.txt");
			expect(file.fetch()).rejects.toThrow(NotFoundError);

			await expectErrorWithProperties(() => file.fetch(), NotFoundError, {
				path: "/nonexistent.txt",
			});
		});

		test("infers missing MIME type from extension when supportsMimeTypes is false", async () => {
			const noMimeEndpoint = memoryStorage({
				supportsMimeTypes: false,
				initialFiles: {
					"test.png": { data: "content", mimeType: undefined },
				},
			});
			const noMimeDisk = new StorageDiskImpl("test", noMimeEndpoint);
			const file = noMimeDisk.file("test.png");
			const result = await file.fetch();
			expect(result.headers.get("Content-Type")).toBe("image/png");
		});

		test("overrides present MIME type from extension when supportsMimeTypes is false", async () => {
			const noMimeEndpoint = memoryStorage({
				supportsMimeTypes: false,
				initialFiles: {
					"test.png": { data: "content", mimeType: "image/jpeg" },
				},
			});
			const noMimeDisk = new StorageDiskImpl("test", noMimeEndpoint);
			const file = noMimeDisk.file("test.png");
			const result = await file.fetch();
			expect(result.headers.get("Content-Type")).toBe("image/png");
		});

		test("infers missing MIME type from extension when supportsMimeTypes is true", async () => {
			const noMimeEndpoint = memoryStorage({
				supportsMimeTypes: true,
				initialFiles: {
					"test.png": { data: "content", mimeType: undefined },
				},
			});
			const noMimeDisk = new StorageDiskImpl("test", noMimeEndpoint);
			const file = noMimeDisk.file("test.png");
			const result = await file.fetch();
			expect(result.headers.get("Content-Type")).toBe("image/png");
		});

		test("does not override present MIME type from extension when supportsMimeTypes is true", async () => {
			const noMimeEndpoint = memoryStorage({
				supportsMimeTypes: true,
				initialFiles: {
					"test.png": { data: "content", mimeType: "image/jpeg" },
				},
			});
			const noMimeDisk = new StorageDiskImpl("test", noMimeEndpoint);
			const file = noMimeDisk.file("test.png");
			const result = await file.fetch();
			expect(result.headers.get("Content-Type")).toBe("image/jpeg");
		});

		test("preserves original Content-Type when supportsMimeTypes is true", async () => {
			const file = disk.file("test.txt");
			await file.put({ data: "content", mimeType: "custom/type" });
			const result = await file.fetch();
			expect(result.headers.get("Content-Type")).toBe("custom/type");
		});
	});

	describe("info()", () => {
		test("returns file info when file exists", async () => {
			const file = disk.file("test.txt");
			await file.put({ data: "content", mimeType: "text/plain" });
			const result = await file.info();
			expect(result).toMatchObject({
				size: 7,
				mimeType: "text/plain",
			});
			expect(result?.etag).toBeDefined();
		});

		test("returns null when file doesn't exist", async () => {
			const file = disk.file("nonexistent.txt");
			const result = await file.info();
			expect(result).toBeNull();
		});

		test("if endpoint throws FileNotFound we convert to null", async () => {
			const file = disk.file("nonexistent.txt");
			spyOn(endpoint, "getInfoSingle").mockImplementation(async () => {
				throw new NotFoundError("nonexistent.txt");
			});
			const result = await file.info();
			expect(result).toBeNull();
		});

		test("handles missing mime type", async () => {
			const endpoint = memoryStorage({
				supportsMimeTypes: false,
				initialFiles: {
					"test.png": { data: "content", mimeType: undefined },
				},
			});
			const disk = new StorageDiskImpl("test", endpoint);
			const result = await disk.file("test.bin").info();
			expect(result?.mimeType).toBeUndefined();
		});
	});

	describe("url()", () => {
		test("returns URL with path and 100y expiration", async () => {
			const file = disk.file("test.txt");
			const result = await file.url();
			expect(result).toBe("memory:///test.txt?expires=2124-12-08T00:00:00.000Z");
		});

		test("passes downloadAs option", async () => {
			const file = disk.file("test.txt");
			const result = await file.url({ downloadAs: "custom.txt" });
			expect(result).toBe(
				"memory:///test.txt?download=custom.txt&expires=2124-12-08T00:00:00.000Z",
			);
		});
	});

	describe("signedUrl()", () => {
		test("defaults to 100y expiration", async () => {
			const file = disk.file("test.txt");
			const result = await file.signedUrl();
			expect(result).toBe("memory:///test.txt?expires=2124-12-08T00:00:00.000Z");
		});

		test("accepts custom expires duration string", async () => {
			const file = disk.file("test.txt");
			const result = await file.signedUrl({ expires: "1h" });
			expect(result).toBe("memory:///test.txt?expires=2025-01-01T01:00:00.000Z");
		});

		test("accepts custom expires Date", async () => {
			const file = disk.file("test.txt");
			const customDate = new Date("2025-06-15T12:30:00Z");
			const result = await file.signedUrl({ expires: customDate });
			expect(result).toBe("memory:///test.txt?expires=2025-06-15T12:30:00.000Z");
		});

		test("passes downloadAs option", async () => {
			const file = disk.file("test.txt");
			const result = await file.signedUrl({ downloadAs: "custom.txt" });
			expect(result).toBe(
				"memory:///test.txt?download=custom.txt&expires=2124-12-08T00:00:00.000Z",
			);
		});
	});

	describe("uploadUrl()", () => {
		test("by default returns upload URL with 100y expiration", async () => {
			const file = disk.file("test.txt");
			const result = await file.uploadUrl();
			expect(result).toBe("memory:///test.txt?upload=true&expires=2124-12-08T00:00:00.000Z");
		});

		test("accepts custom expires duration string", async () => {
			const file = disk.file("test.txt");
			const result = await file.uploadUrl({ expires: "1h" });
			expect(result).toBe("memory:///test.txt?upload=true&expires=2025-01-01T01:00:00.000Z");
		});

		test("accepts custom expires Date", async () => {
			const file = disk.file("test.txt");
			const customDate = new Date("2025-06-15T12:30:00Z");
			const result = await file.uploadUrl({ expires: customDate });
			expect(result).toBe("memory:///test.txt?upload=true&expires=2025-06-15T12:30:00.000Z");
		});
	});

	describe("put()", () => {
		test("works with explicit data and mimetype", async () => {
			const file = disk.file("dir/document.pdf");
			await file.put({ data: "content", mimeType: "application/pdf" });
			const response = await file.fetch();
			expect(response.headers.get("content-type")).toBe("application/pdf");
			expect(await response.text()).toBe("content");
		});

		test("extracts mimeType from File and uses file path", async () => {
			const file = disk.file("dir/document.pdf");
			const fileObj = new File(["content"], "document.pdf", { type: "application/pdf" });
			await file.put(fileObj);
			const info = await file.info();
			expect(info?.mimeType).toBe("application/pdf");
		});

		test("defaults to application/octet-stream when File has no type", async () => {
			const file = disk.file("dir/unknown.dat");
			const fileObj = new File(["content"], "unknown.dat", { type: "" });
			await file.put(fileObj);
			const info = await file.info();
			expect(info?.mimeType).toBe("application/octet-stream");
		});

		test("extracts Content-Type from Request", async () => {
			const file = disk.file("uploads/document.pdf");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "data",
				headers: {
					"Content-Type": "application/pdf",
				},
			});
			await file.put(request);
			const info = await file.info();
			expect(info?.mimeType).toBe("application/pdf");
		});

		test("defaults to application/octet-stream when Request has no Content-Type", async () => {
			const file = disk.file("uploads/file.dat");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "data",
			});
			await file.put(request);
			const info = await file.info();
			expect(info?.mimeType).toBe("application/octet-stream");
		});
	});

	describe("copyTo()", () => {
		test("copies file on same disk", async () => {
			const source = disk.file("source.txt");
			await source.put({ data: "hello", mimeType: "text/plain" });
			const dest = disk.file("dest.txt");
			spyOnAll(endpoint);
			await source.copyTo(dest);
			expect(endpoint.readSingle).not.toHaveBeenCalled();
			expect(endpoint.copy).toHaveBeenCalledWith("/source.txt", "/dest.txt");
			expect(await dest.exists()).toBe(true);
			const response = await dest.fetch();
			expect(await response.text()).toBe("hello");
		});

		test("copies file to different disk", async () => {
			const endpoint2 = memoryStorage({});
			const disk2 = new StorageDiskImpl("disk2", endpoint2);
			const source = disk.file("source.txt");
			await source.put({ data: "hello", mimeType: "text/plain" });
			const dest = disk2.file("dest.txt");
			spyOnAll(endpoint);
			spyOnAll(endpoint2);
			await source.copyTo(dest);
			expect(endpoint.readSingle).toHaveBeenCalledWith("/source.txt");
			expect(endpoint.copy).not.toHaveBeenCalled();
			expect(endpoint2.writeSingle).toHaveBeenCalledWith({
				// we should use ReadableStream to stream data from one endpoint to another
				data: expect.any(ReadableStream),
				mimeType: "text/plain",
				path: "/dest.txt",
			});
			expect(endpoint2.copy).not.toHaveBeenCalled();
			expect(await dest.exists()).toBe(true);
			const response = await dest.fetch();
			expect(await response.text()).toBe("hello");
		});

		test("throws when source file doesn't exist on same-disk transfer", async () => {
			const source = disk.file("nonexistent.txt");
			const dest = disk.file("dest.txt");
			// Same-disk copy uses endpoint.copy() which may throw various errors
			// These get wrapped in StorageFailureError by withStorageErrors()
			expect(source.copyTo(dest)).rejects.toThrow();
		});

		test("throws when source file doesn't exist on cross-disk transfer", async () => {
			const endpoint2 = memoryStorage({});
			const disk2 = new StorageDiskImpl("disk2", endpoint2);
			const source = disk.file("nonexistent.txt");
			const dest = disk2.file("dest.txt");
			expect(source.copyTo(dest)).rejects.toThrow(NotFoundError);

			await expectErrorWithProperties(() => source.copyTo(dest), NotFoundError, {
				path: "/nonexistent.txt",
			});
		});
	});

	describe("moveTo()", () => {
		test("moves file on same disk", async () => {
			const source = disk.file("source.txt");
			await source.put({ data: "hello", mimeType: "text/plain" });
			const dest = disk.file("dest.txt");
			spyOnAll(endpoint);
			await source.moveTo(dest);
			expect(endpoint.move).toHaveBeenCalledWith("/source.txt", "/dest.txt");
			expect(endpoint.copy).not.toHaveBeenCalled();
			expect(endpoint.readSingle).not.toHaveBeenCalled();
			expect(await dest.exists()).toBe(true);
			const response = await dest.fetch();
			expect(await response.text()).toBe("hello");
			expect(await source.exists()).toBe(false);
		});

		test("moves file to different disk", async () => {
			const endpoint2 = memoryStorage({});
			const disk2 = new StorageDiskImpl("disk2", endpoint2);
			const source = disk.file("source.txt");
			await source.put({ data: "hello", mimeType: "text/plain" });
			const dest = disk2.file("dest.txt");
			spyOnAll(endpoint);
			spyOnAll(endpoint2);
			await source.moveTo(dest);
			expect(endpoint.move).not.toHaveBeenCalled();
			expect(endpoint.copy).not.toHaveBeenCalled();
			expect(endpoint.readSingle).toHaveBeenCalledWith("/source.txt");
			expect(endpoint2.writeSingle).toHaveBeenCalledWith({
				// should use streaming
				data: expect.any(ReadableStream),
				mimeType: "text/plain",
				path: "/dest.txt",
			});
			expect(endpoint.deleteSingle).toHaveBeenCalledWith("/source.txt");
			const response = await dest.fetch();
			expect(await response.text()).toBe("hello");
			expect(response.headers.get("content-type")).toBe("text/plain");
			expect(await source.exists()).toBe(false);
		});

		test("throws when source file doesn't exist on same-disk move", async () => {
			const source = disk.file("nonexistent.txt");
			const dest = disk.file("dest.txt");
			spyOn(endpoint, "move").mockImplementation(async () => {
				throw new Error("Source file not found: /nonexistent.txt");
			});
			expect(source.moveTo(dest)).rejects.toThrow("Source file not found");
		});

		test("throws when source file doesn't exist on cross-disk move", async () => {
			const endpoint2 = memoryStorage({});
			const disk2 = new StorageDiskImpl("disk2", endpoint2);
			const source = disk.file("nonexistent.txt");
			const dest = disk2.file("dest.txt");
			expect(source.moveTo(dest)).rejects.toThrow(NotFoundError);
		});

		test("does not delete source if cross-disk copy fails", async () => {
			const endpoint2 = memoryStorage({});
			const disk2 = new StorageDiskImpl("disk2", endpoint2);
			const source = disk.file("source.txt");
			await source.put({ data: "hello", mimeType: "text/plain" });
			const dest = disk2.file("dest.txt");
			spyOn(endpoint2, "writeSingle").mockImplementation(async () => {
				throw new Error("Write failed");
			});
			spyOn(endpoint, "deleteSingle");
			expect(source.moveTo(dest)).rejects.toThrow("Write failed");
			expect(endpoint.deleteSingle).not.toHaveBeenCalled();
			expect(await source.exists()).toBe(true);
		});
	});

	describe("toString()", () => {
		test("returns [StorageFileImpl endpoint://path]", () => {
			const endpoint = memoryStorage({ name: "test-endpoint" });
			const disk = new StorageDiskImpl("test", endpoint);
			const file = new StorageFileImpl(disk, endpoint, "/path/to/file.txt");
			expect(file.toString()).toBe("[StorageFileImpl test-endpoint://path/to/file.txt]");
		});
	});
});
