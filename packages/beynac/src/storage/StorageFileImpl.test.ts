import { describe, expect, mock, test } from "bun:test";
import type { StorageEndpointFileInfo } from "../contracts/Storage";
import { memoryStorage } from "./drivers/memory/MemoryStorageDriver";
import { StorageDiskImpl } from "./StorageDiskImpl";
import { StorageFileImpl } from "./StorageFileImpl";
import { mockStorageEndpoint } from "./test-helpers";

describe(StorageFileImpl, () => {
	const endpoint = memoryStorage({});
	const disk = new StorageDiskImpl("test", endpoint);

	describe("constructor", () => {
		test("stores path as-is without normalization", () => {
			const disk = new StorageDiskImpl("test", endpoint);
			const file = new StorageFileImpl(disk, endpoint, "/path/to/file.txt");
			expect(file.path).toBe("/path/to/file.txt");
		});

		test("accepts path with trailing slash as-is", () => {
			expect(new StorageFileImpl(disk, endpoint, "/path/to/file.txt/").path).toBe(
				"/path/to/file.txt/",
			);
		});

		test("handles empty path", () => {
			const disk = new StorageDiskImpl("test", endpoint);
			const file = new StorageFileImpl(disk, endpoint, "");
			expect(file.path).toBe("");
		});
	});

	describe("delete()", () => {
		test("delegates to endpoint.deleteSingle with correct path", async () => {
			const mockEndpoint = mockStorageEndpoint();
			const file = new StorageFileImpl(disk, mockEndpoint, "/test.txt");
			await file.delete();
			expect(mockEndpoint.deleteSingle).toHaveBeenCalledWith("/test.txt");
		});
	});

	describe("exists()", () => {
		test("delegates to endpoint.existsSingle and returns result", async () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.existsSingle = mock(async () => true);
			const file = new StorageFileImpl(disk, mockEndpoint, "/test.txt");
			const result = await file.exists();
			expect(result).toBe(true);
			expect(mockEndpoint.existsSingle).toHaveBeenCalledWith("/test.txt");
		});
	});

	describe("fetch()", () => {
		test("delegates to endpoint.readSingle and returns response", async () => {
			const mockResponse = new Response("content", { status: 200 });
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.readSingle = mock(async () => mockResponse);
			const file = new StorageFileImpl(disk, mockEndpoint, "/test.txt");
			const result = await file.fetch();
			expect(result).toBe(mockResponse);
			expect(mockEndpoint.readSingle).toHaveBeenCalledWith("/test.txt");
		});

		test("throws when response is not ok", async () => {
			const mockResponse = new Response("error", { status: 404 });
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.readSingle = mock(async () => mockResponse);
			const file = new StorageFileImpl(disk, mockEndpoint, "/test.txt");
			expect(file.fetch()).rejects.toThrow("Failed to fetch file");
		});
	});

	describe("info()", () => {
		test("delegates to endpoint.getInfoSingle and transforms result", async () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.getInfoSingle = mock(async () => ({
				etag: "abc123",
				contentLength: 100,
				mimeType: "text/plain",
			}));
			const file = new StorageFileImpl(disk, mockEndpoint, "/test.txt");
			const result = await file.info();
			expect(result).toEqual({
				etag: "abc123",
				size: 100,
				mimeType: "text/plain",
			});
			expect(mockEndpoint.getInfoSingle).toHaveBeenCalledWith("/test.txt");
		});

		test("returns null when endpoint returns null", async () => {
			const mockEndpoint = mockStorageEndpoint();
			const file = new StorageFileImpl(disk, mockEndpoint, "/test.txt");
			const result = await file.info();
			expect(result).toBeNull();
		});
	});

	describe("url()", () => {
		test("delegates to endpoint.getSignedDownloadUrl with default expiry", async () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.getSignedDownloadUrl = mock(async () => "https://example.com/file");
			const file = new StorageFileImpl(disk, mockEndpoint, "/test.txt");
			const result = await file.url();
			expect(result).toBe("https://example.com/file");
			expect(mockEndpoint.getSignedDownloadUrl).toHaveBeenCalledWith(
				"/test.txt",
				expect.any(Date),
				undefined,
			);
		});

		test("passes downloadAs option to endpoint", async () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.getSignedDownloadUrl = mock(async () => "https://example.com/file");
			const file = new StorageFileImpl(disk, mockEndpoint, "/test.txt");
			await file.url({ downloadAs: "custom.txt" });
			expect(mockEndpoint.getSignedDownloadUrl).toHaveBeenCalledWith(
				expect.anything(),
				expect.any(Date),
				"custom.txt",
			);
		});
	});

	describe("uploadUrl()", () => {
		test("delegates to endpoint.getTemporaryUploadUrl with default expiry", async () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.getTemporaryUploadUrl = mock(async () => "https://example.com/upload");
			const file = new StorageFileImpl(disk, mockEndpoint, "/test.txt");
			const result = await file.uploadUrl();
			expect(result).toBe("https://example.com/upload");
			expect(mockEndpoint.getTemporaryUploadUrl).toHaveBeenCalled();
		});

		test("accepts string expiry pattern", async () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.getTemporaryUploadUrl = mock(async () => "https://example.com/upload");
			const file = new StorageFileImpl(disk, mockEndpoint, "/test.txt");
			await file.uploadUrl({ expires: "1h" });
			expect(mockEndpoint.getTemporaryUploadUrl).toHaveBeenCalledWith(
				expect.anything(),
				expect.any(Date),
			);
		});

		test("accepts Date expiry", async () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.getTemporaryUploadUrl = mock(async () => "https://example.com/upload");
			const expiryDate = new Date(Date.now() + 3600000);
			const file = new StorageFileImpl(disk, mockEndpoint, "/test.txt");
			await file.uploadUrl({ expires: expiryDate });
			expect(mockEndpoint.getTemporaryUploadUrl).toHaveBeenCalledWith(
				expect.anything(),
				expiryDate,
			);
		});
	});

	describe("fetch() MIME type inference", () => {
		test("infers MIME type from extension when supportsMimeTypes is false", async () => {
			const mockResponse = new Response("content", {
				status: 200,
				headers: { "Content-Length": "7" },
			});
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.supportsMimeTypes = false;
			mockEndpoint.readSingle = mock(async () => mockResponse);
			const file = new StorageFileImpl(disk, mockEndpoint, "/test.png");
			const result = await file.fetch();
			expect(result.headers.get("Content-Type")).toBe("image/png");
		});

		test("preserves original Content-Type when supportsMimeTypes is true", async () => {
			const mockResponse = new Response("content", {
				status: 200,
				headers: { "Content-Type": "custom/type" },
			});
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.readSingle = mock(async () => mockResponse);
			const file = new StorageFileImpl(disk, mockEndpoint, "/test.txt");
			const result = await file.fetch();
			expect(result.headers.get("Content-Type")).toBe("custom/type");
		});
	});

	describe("info() mimeType defaults", () => {
		test("defaults mimeType to application/octet-stream when null", async () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.getInfoSingle = mock(
				async (): Promise<StorageEndpointFileInfo | null> => ({
					etag: "abc",
					contentLength: 100,
				}),
			);
			const file = new StorageFileImpl(disk, mockEndpoint, "/test.bin");
			const result = await file.info();
			expect(result?.mimeType).toBe("application/octet-stream");
		});
	});

	describe("put() with File object", () => {
		test("extracts mimeType from File and uses file path", async () => {
			const mockEndpoint = mockStorageEndpoint();
			const file = new StorageFileImpl(disk, mockEndpoint, "/dir/document.pdf");
			const fileObj = new File(["/content"], "document.pdf", { type: "application/pdf" });
			const result = await file.put(fileObj);
			expect(result.actualName).toBe("document.pdf");
			expect(result.actualPath).toBe("/dir/document.pdf");
			expect(mockEndpoint.writeSingle).toHaveBeenCalledWith(
				expect.objectContaining({
					mimeType: "application/pdf",
				}),
			);
		});

		test("defaults to application/octet-stream when File has no type", async () => {
			const mockEndpoint = mockStorageEndpoint();
			const file = new StorageFileImpl(disk, mockEndpoint, "/dir/unknown.dat");
			const fileObj = new File(["/content"], "unknown.dat", { type: "" });
			await file.put(fileObj);
			expect(mockEndpoint.writeSingle).toHaveBeenCalledWith(
				expect.objectContaining({
					mimeType: "application/octet-stream",
				}),
			);
		});
	});

	describe("put() with Request object", () => {
		test("defaults to application/octet-stream when no Content-Type", async () => {
			const mockEndpoint = mockStorageEndpoint();
			const file = new StorageFileImpl(disk, mockEndpoint, "/uploads/file.dat");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "data",
			});
			await file.put(request);
			expect(mockEndpoint.writeSingle).toHaveBeenCalledWith(
				expect.objectContaining({
					mimeType: "application/octet-stream",
				}),
			);
		});
	});

	describe("put() path logic", () => {
		test("uses file's path", async () => {
			const mockEndpoint = mockStorageEndpoint();
			const file = new StorageFileImpl(disk, mockEndpoint, "/uploads/file.txt");
			await file.put({ data: "content", mimeType: "text/plain" });
			expect(mockEndpoint.writeSingle).toHaveBeenCalledWith(
				expect.objectContaining({
					path: "/uploads/file.txt",
				}),
			);
		});

		test("returns actualName and actualPath", async () => {
			const mockEndpoint = mockStorageEndpoint();
			const file = new StorageFileImpl(disk, mockEndpoint, "/dir/document.pdf");
			const result = await file.put({ data: "content", mimeType: "application/pdf" });
			expect(result.actualName).toBe("document.pdf");
			expect(result.actualPath).toBe("/dir/document.pdf");
		});
	});

	describe("copyTo()", () => {
		test("uses endpoint.copy() for same disk", async () => {
			const mockEndpoint = mockStorageEndpoint();
			const sameDisk = new StorageDiskImpl("test", mockEndpoint);
			const source = new StorageFileImpl(sameDisk, mockEndpoint, "/source.txt");
			const dest = new StorageFileImpl(sameDisk, mockEndpoint, "/dest.txt");
			const result = await source.copyTo(dest);
			expect(mockEndpoint.copy).toHaveBeenCalledWith("/source.txt", "/dest.txt");
			expect(result.actualPath).toBe("/dest.txt");
			expect(result.actualName).toBe("dest.txt");
		});

		test("uses fetch+put for different disk", async () => {
			const endpoint1 = memoryStorage({});
			const endpoint2 = memoryStorage({});
			const disk1 = new StorageDiskImpl("disk1", endpoint1);
			const disk2 = new StorageDiskImpl("disk2", endpoint2);
			const source = disk1.file("source.txt");
			await source.put({ data: "hello", mimeType: "text/plain" });
			const dest = disk2.file("dest.txt");
			await source.copyTo(dest);
			expect(await dest.exists()).toBe(true);
			const response = await dest.fetch();
			expect(await response.text()).toBe("hello");
		});

		test("throws when source file doesn't exist", async () => {
			const endpoint1 = memoryStorage({});
			const endpoint2 = memoryStorage({});
			const disk1 = new StorageDiskImpl("disk1", endpoint1);
			const disk2 = new StorageDiskImpl("disk2", endpoint2);
			const source = disk1.file("nonexistent.txt");
			const dest = disk2.file("dest.txt");
			expect(source.copyTo(dest)).rejects.toThrow("Failed to fetch file");
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
