import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { StorageDisk, StorageEndpoint } from "../../contracts/Storage";
import { expectErrorWithProperties, mockDispatcher } from "../../test-utils";
import { asyncGeneratorToArray } from "../../utils";
import { StorageImpl } from "../StorageImpl";
import { NotFoundError } from "../storage-errors";
import { filesystemStorageSharedTestConfig } from "./filesystem/FilesystemStorageDriver.test";
import { memoryStorage } from "./memory/MemoryStorageDriver";
import { memoryStorageSharedTestConfig } from "./memory/MemoryStorageDriver.test";

export type SharedTestConfig = {
	name: string;
	createEndpoint: () => StorageEndpoint;
};

const driverConfigs: SharedTestConfig[] = [
	memoryStorageSharedTestConfig,
	filesystemStorageSharedTestConfig,
];

describe.each(driverConfigs)("$name", ({ createEndpoint }) => {
	let endpoint: StorageEndpoint;

	beforeEach(() => {
		endpoint = createEndpoint();
	});

	describe("Shared Integration Tests", () => {
		describe("Read-only file and directory operations", () => {
			// Shared init for all read-only tests for performance
			let storage: StorageImpl;
			let disk: StorageDisk;
			let endpoint: StorageEndpoint;
			beforeAll(async () => {
				endpoint = createEndpoint();
				storage = new StorageImpl(
					{
						disks: { test: endpoint },
						defaultDisk: "test",
					},
					mockDispatcher(),
				);
				disk = storage.disk();
				const files = [
					["/existing.txt", "content", "text/plain"],
					["/dir/textFile", "textual-data", "text/plain"],
					["/dir/htmlFile", "html-data", "text/html"],
					["/dir/nested/file3.txt", "3", "text/plain"],
					["/dir/nested/deep/file4.txt", "4", "text/plain"],
				];
				for (const [path, content, mimeType] of files) {
					await disk.file(path).put({ data: content, mimeType });
				}
			});

			test("file.exists()", async () => {
				expect(await disk.file("/existing.txt").exists()).toBe(true);
				expect(await disk.file("/nonexistent.txt").exists()).toBe(false);
			});

			test("file.fetch()", async () => {
				// Insert the text file first. We expect it to come out in
				// alphabetical order, i.e. second, rather than insertion order.
				const textFetchResult = await disk.file("/dir/textFile").fetch();
				expect(await textFetchResult.response.text()).toBe("textual-data");
				expect(textFetchResult.size).toBe(12);
				// If driver doesn't support MIME types, files without extensions get octet-stream
				const expectedTextMime = endpoint.supportsMimeTypes
					? "text/plain"
					: "application/octet-stream";
				expect(textFetchResult.mimeType).toBe(expectedTextMime);
				expect(textFetchResult.response.headers.get("Content-Length")).toBe("12");
				expect(textFetchResult.response.headers.get("Content-Type")).toBe(expectedTextMime);

				const htmlFetchResult = await disk.file("/dir/htmlFile").fetch();
				expect(await htmlFetchResult.response.text()).toBe("html-data");
				expect(htmlFetchResult.size).toBe(9);
				const expectedHtmlMime = endpoint.supportsMimeTypes
					? "text/html"
					: "application/octet-stream";
				expect(htmlFetchResult.mimeType).toBe(expectedHtmlMime);
				expect(htmlFetchResult.response.headers.get("Content-Length")).toBe("9");
				expect(htmlFetchResult.response.headers.get("Content-Type")).toBe(expectedHtmlMime);

				await expectErrorWithProperties(
					() => disk.file("/nonexistent.txt").fetch(),
					NotFoundError,
					{ path: "/nonexistent.txt" },
				);
			});

			test("file.info()", async () => {
				// Existing files
				const info = await disk.file("/existing.txt").info();
				expect(info).toEqual({
					size: 7,
					mimeType: "text/plain",
					// originalMimeType is what the endpoint stored; null for drivers that don't support MIME types
					originalMimeType: endpoint.supportsMimeTypes ? "text/plain" : null,
					etag: expect.any(String),
				});

				const htmlInfo = await disk.file("/dir/htmlFile").info();
				const expectedHtmlMime = endpoint.supportsMimeTypes
					? "text/html"
					: "application/octet-stream";
				expect(htmlInfo?.mimeType).toBe(expectedHtmlMime);
				expect(htmlInfo).toEqual({
					size: 9,
					mimeType: expectedHtmlMime,
					originalMimeType: endpoint.supportsMimeTypes ? "text/html" : null,
					etag: expect.any(String),
				});

				expect(info?.etag).not.toEqual(htmlInfo?.etag);

				// Null on non-existent files
				expect(await disk.file("/nonexistent.txt").info()).toBe(null);
			});

			test("file.url()", async () => {
				const existingUrl = await disk.file("/existing.txt").url();
				expect(existingUrl).toMatch(/^[a-z]+(-[a-z]+)*:/);

				// Non-existent files must work
				const nonExistingUrl = await disk.file("/nonexistent.txt").url();
				expect(nonExistingUrl).toMatch(URL_REGEX);
			});

			test("file.signedUrl()", async () => {
				const existingUrl = await storage.disk().file("/existing.txt").signedUrl({ expires: "1h" });
				expect(existingUrl).toMatch(URL_REGEX);

				// Non-existent files must work
				const nonExistingUrl = await storage
					.disk()
					.file("/nonexistent.txt")
					.signedUrl({ expires: "1h" });
				expect(nonExistingUrl).toMatch(URL_REGEX);
			});

			test("file.uploadUrl()", async () => {
				const existingUrl = await storage.disk().file("/existing.txt").uploadUrl({ expires: "1h" });
				expect(existingUrl).toMatch(URL_REGEX);

				// Non-existent files must work
				const nonExistingUrl = await storage
					.disk()
					.file("/nonexistent.txt")
					.uploadUrl({ expires: "1h" });
				expect(nonExistingUrl).toMatch(URL_REGEX);
			});

			test("directory.exists()", async () => {
				expect(await disk.directory("/dir/").exists()).toBe(true);
				expect(await disk.directory("/empty/").exists()).toBe(false);
			});

			test("directory.list()", async () => {
				const entries = await disk.directory("/dir/").list();
				expect(entries.map((e) => e.path)).toEqual([
					"/dir/htmlFile",
					"/dir/nested/",
					"/dir/textFile",
				]);

				// Shouldn't throw
				await disk.directory("/non-existent/").list();
			});

			test("directory.files() - immediate only", async () => {
				const files = await disk.directory("/dir/").files();
				expect(files.map((f) => f.path)).toEqual(["/dir/htmlFile", "/dir/textFile"]);

				// Shouldn't throw
				await disk.directory("/non-existent/").files();
			});

			test("directory.files({ recursive: false })", async () => {
				const files = await disk.directory("/dir/").files({ recursive: false });
				expect(files.map((f) => f.path)).toEqual(["/dir/htmlFile", "/dir/textFile"]);

				// Shouldn't throw
				await disk.directory("/non-existent/").files({ recursive: false });
			});

			test("directory.files({ recursive: true })", async () => {
				const files = await disk.directory("/dir/").files({ recursive: true });
				expect(files.map((f) => f.path)).toEqual([
					"/dir/htmlFile",
					"/dir/nested/deep/file4.txt",
					"/dir/nested/file3.txt",
					"/dir/textFile",
				]);

				// Shouldn't throw
				await disk.directory("/non-existent/").files({ recursive: true });
			});

			test("directory.directories()", async () => {
				const dirs = await disk.directory("/dir/").directories();
				expect(dirs.map((d) => d.path)).toEqual(["/dir/nested/"]);

				// Shouldn't throw
				await disk.directory("/non-existent/").directories();
			});

			test("endpoint.listEntries() returns relative paths for /dir/", async () => {
				const entries = await asyncGeneratorToArray(endpoint.listEntries("/dir/"));
				expect(entries).toEqual(["htmlFile", "nested/", "textFile"]);
			});

			test("endpoint.listEntries() returns relative paths for root /", async () => {
				const entries = await asyncGeneratorToArray(endpoint.listEntries("/"));
				expect(entries).toEqual(["dir/", "existing.txt"]);
			});

			test("endpoint.listEntries() returns relative paths for /dir/nested/", async () => {
				const entries = await asyncGeneratorToArray(endpoint.listEntries("/dir/nested/"));
				expect(entries).toEqual(["deep/", "file3.txt"]);
			});

			test("endpoint.listFilesRecursive() returns relative paths for /dir/", async () => {
				// Shared data: /dir/textFile, /dir/htmlFile, /dir/nested/file3.txt, /dir/nested/deep/file4.txt
				const files = await asyncGeneratorToArray(endpoint.listFilesRecursive("/dir/"));

				expect(files).toEqual([
					"htmlFile",
					"nested/deep/file4.txt",
					"nested/file3.txt",
					"textFile",
				]);
			});

			test("endpoint.listFilesRecursive() returns relative paths for root /", async () => {
				// Shared data: all files
				const files = await asyncGeneratorToArray(endpoint.listFilesRecursive("/"));

				expect(files).toEqual([
					"dir/htmlFile",
					"dir/nested/deep/file4.txt",
					"dir/nested/file3.txt",
					"dir/textFile",
					"existing.txt",
				]);
			});

			test("endpoint.listFilesRecursive() returns relative paths for /dir/nested/", async () => {
				// Shared data: /dir/nested/file3.txt, /dir/nested/deep/file4.txt
				const files = await asyncGeneratorToArray(endpoint.listFilesRecursive("/dir/nested/"));

				expect(files).toEqual(["deep/file4.txt", "file3.txt"]);
			});
		});

		describe("Mutable file and directory operations", () => {
			let storage: StorageImpl;
			let disk: StorageDisk;
			beforeEach(async () => {
				storage = new StorageImpl(
					{
						disks: { test: createEndpoint() },
						defaultDisk: "test",
					},
					mockDispatcher(),
				);
				disk = storage.disk();
			});

			describe("file.put() and file.delete()", async () => {
				test("with text data", async () => {
					const file = disk.file("/test.txt");

					await file.put({ data: "content1", mimeType: "text/plain" });
					expect(await file.exists()).toBe(true);

					// overwrite is OK
					await file.put({ data: "content2", mimeType: "text/plain" });
					expect(await (await file.fetch()).response.text()).toBe("content2");

					await file.delete();
					expect(await file.exists()).toBe(false);

					// Deleting non-existent file is OK
					await file.delete();
					// Deleting file that never existed is OK
					await disk.file("/never-existed").delete();
				});

				test("with binary data", async () => {
					const data = new Uint8Array([1, 2, 3]);
					const file = disk.file("/test.bin");
					await file.put({ data, mimeType: "application/octet-stream" });
					expect(await file.exists()).toBe(true);

					expect(await (await file.fetch()).response.arrayBuffer()).toEqual(data.buffer);

					await file.delete();
					expect(await file.exists()).toBe(false);
				});
			});

			describe("file.copyTo()", () => {
				test("same disk", async () => {
					const source = disk.file("/source.txt");
					await source.put({ data: "content", mimeType: "text/plain" });
					const dest = disk.file("/dest.txt");
					await source.copyTo(dest);
					expect(await source.exists()).toBe(true);
					expect(await dest.exists()).toBe(true);

					const missing = disk.file("/nonexistent.txt");
					await expectErrorWithProperties(
						() => missing.copyTo(disk.file("/dest2.txt")),
						NotFoundError,
						{ path: "/nonexistent.txt" },
					);
				});

				test("cross-disk, same driver", async () => {
					const source = disk.file("/source.txt");
					await source.put({ data: "content", mimeType: "text/plain" });
					const disk2 = storage.build(createEndpoint());

					const dest = disk2.file("/dest.txt");
					await source.copyTo(dest);
					expect(await dest.exists()).toBe(true);

					const missing = disk.file("/nonexistent.txt");
					await expectErrorWithProperties(
						() => missing.copyTo(disk2.file("/dest2.txt")),
						NotFoundError,
						{ path: "/nonexistent.txt" },
					);
				});

				test("cross-disk, different driver", async () => {
					const memoryDisk = storage.build(memoryStorage());

					// From memory driver
					const memorySource = memoryDisk.file("/source.txt");
					await memorySource.put({ data: "content", mimeType: "text/plain" });
					const dest1 = disk.file("/dest.txt");
					await memorySource.copyTo(dest1);
					expect(await memorySource.exists()).toBe(true);
					expect(await dest1.exists()).toBe(true);

					// To memory driver
					const source = disk.file("/source.txt");
					await source.put({ data: "content", mimeType: "text/plain" });
					const memoryDest = memoryDisk.file("/dest2.txt");
					await source.copyTo(memoryDest);
					expect(await source.exists()).toBe(true);
					expect(await memoryDest.exists()).toBe(true);
				});
			});

			describe("file.moveTo()", () => {
				test("same disk", async () => {
					const source = disk.file("/source.txt");
					await source.put({ data: "content", mimeType: "text/plain" });
					const dest = disk.file("/dest.txt");
					await source.moveTo(dest);
					expect(await dest.exists()).toBe(true);
					expect(await source.exists()).toBe(false);

					const missing = disk.file("/nonexistent.txt");
					await expectErrorWithProperties(
						() => missing.moveTo(disk.file("/dest2.txt")),
						NotFoundError,
						{ path: "/nonexistent.txt" },
					);
				});

				test("cross-disk, same driver", async () => {
					const source = disk.file("/source.txt");
					await source.put({ data: "content", mimeType: "text/plain" });
					const disk2 = storage.build(createEndpoint());

					const dest = disk2.file("/dest.txt");
					await source.moveTo(dest);
					expect(await dest.exists()).toBe(true);
					expect(await source.exists()).toBe(false);

					const missing = disk.file("/nonexistent.txt");
					await expectErrorWithProperties(
						() => missing.moveTo(disk2.file("/dest2.txt")),
						NotFoundError,
						{ path: "/nonexistent.txt" },
					);
				});

				test("cross-disk, different driver", async () => {
					const memoryDisk = storage.build(memoryStorage());

					// From memory driver
					const memorySource = memoryDisk.file("/source.txt");
					await memorySource.put({ data: "content", mimeType: "text/plain" });
					const dest1 = disk.file("/dest.txt");
					await memorySource.moveTo(dest1);
					expect(await dest1.exists()).toBe(true);
					expect(await memorySource.exists()).toBe(false);

					// To memory driver
					const source = disk.file("/source.txt");
					await source.put({ data: "content", mimeType: "text/plain" });
					const memoryDest = memoryDisk.file("/dest2.txt");
					await source.moveTo(memoryDest);
					expect(await memoryDest.exists()).toBe(true);
					expect(await source.exists()).toBe(false);
				});
			});

			test("directory.deleteAll()", async () => {
				const dir = disk.directory("/subdir/");

				await dir.file("file1.txt").put({ data: "1", mimeType: "text/plain" });
				await dir.file("file2.txt").put({ data: "2", mimeType: "text/plain" });
				await dir.directory("nested/").file("file3.txt").put({ data: "3", mimeType: "text/plain" });
				await disk.file("/rootfile.txt").put({ data: "X", mimeType: "text/plain" });
				await disk.file("/otherdir/sibling.txt").put({ data: "X", mimeType: "text/plain" });

				expect(await dir.exists()).toBe(true);
				await dir.deleteAll();
				expect(await dir.exists()).toBe(false);

				const remainingFiles = await disk.files({ recursive: true });
				expect(remainingFiles.map((file) => file.path)).toEqual([
					"/otherdir/sibling.txt",
					"/rootfile.txt",
				]);

				// Can delete already deleted directory
				await dir.deleteAll();
				// Can delete directory that never existed
				await disk.directory("/non-existent/").deleteAll();
			});

			test("directory.putFile()", async () => {
				const dir = disk.directory("/uploads/");

				const file = await dir.putFile({
					data: "content",
					mimeType: "text/plain",
					suggestedName: "test.txt",
				});

				expect(await file.exists()).toBe(true);
				expect(file.path).toBe("/uploads/test.txt");

				// can overwrite
				await dir.putFile({
					data: "content",
					mimeType: "text/plain",
					suggestedName: "test.txt",
				});
			});
		});
	});

	describe("Shared Unit Tests", () => {
		//
		// Contains a few unit tests not covered by the above integration tests.
		//

		describe("writeSingle()", () => {
			test("writes various data types", async () => {
				// String
				await endpoint.writeSingle({
					path: "/test.txt",
					data: "hello",
					mimeType: "text/plain",
				});
				let result = await endpoint.readSingle("/test.txt");
				let response = new Response(result.data);
				expect(await response.text()).toBe("hello");

				// Blob
				const blob = new Blob(["hello"]);
				await endpoint.writeSingle({
					path: "/test2.txt",
					data: blob,
					mimeType: "text/plain",
				});
				result = await endpoint.readSingle("/test2.txt");
				response = new Response(result.data);
				expect(await response.text()).toBe("hello");

				// ArrayBuffer
				const buffer = new ArrayBuffer(8);
				const view = new Uint8Array(buffer);
				view.set([1, 2, 3, 4, 5, 6, 7, 8]);
				await endpoint.writeSingle({
					path: "/test.bin",
					data: buffer,
					mimeType: "application/octet-stream",
				});
				result = await endpoint.readSingle("/test.bin");
				response = new Response(result.data);
				let arrayResult = await response.arrayBuffer();
				expect(new Uint8Array(arrayResult)).toEqual(view);

				// Uint8Array
				const data = new Uint8Array([1, 2, 3, 4]);
				await endpoint.writeSingle({
					path: "/test2.bin",
					data,
					mimeType: "application/octet-stream",
				});
				result = await endpoint.readSingle("/test2.bin");
				response = new Response(result.data);
				arrayResult = await response.arrayBuffer();
				expect(new Uint8Array(arrayResult)).toEqual(data);

				// ReadableStream
				const stream = new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("hello"));
						controller.close();
					},
				});
				await endpoint.writeSingle({
					path: "/test3.txt",
					data: stream,
					mimeType: "text/plain",
				});
				result = await endpoint.readSingle("/test3.txt");
				response = new Response(result.data);
				expect(await response.text()).toBe("hello");
			});
		});

		describe("deleteSingle()", () => {
			test("handles nested paths", async () => {
				await endpoint.writeSingle({
					path: "/a/b/c/test.txt",
					data: "content",
					mimeType: "text/plain",
				});
				await endpoint.deleteSingle("/a/b/c/test.txt");
				expect(await endpoint.existsSingle("/a/b/c/test.txt")).toBe(false);
			});
		});

		describe("copy()", () => {
			test("overwrites existing destination", async () => {
				await endpoint.writeSingle({
					path: "/source.txt",
					data: "new",
					mimeType: "text/plain",
				});
				await endpoint.writeSingle({
					path: "/dest.txt",
					data: "old",
					mimeType: "text/plain",
				});
				await endpoint.copy("/source.txt", "/dest.txt");
				const result = await endpoint.readSingle("/dest.txt");
				const response = new Response(result.data);
				expect(await response.text()).toBe("new");
				expect(await endpoint.existsSingle("/source.txt")).toBe(true);
			});

			test("handles nested paths", async () => {
				await endpoint.writeSingle({
					path: "/dir1/source.txt",
					data: "content",
					mimeType: "text/plain",
				});
				await endpoint.copy("/dir1/source.txt", "/dir2/dest.txt");
				expect(await endpoint.existsSingle("/dir2/dest.txt")).toBe(true);
			});
		});

		describe("move()", () => {
			test("overwrites destination", async () => {
				await endpoint.writeSingle({
					path: "/source.txt",
					data: "new",
					mimeType: "text/plain",
				});
				await endpoint.writeSingle({
					path: "/dest.txt",
					data: "old",
					mimeType: "text/plain",
				});
				await endpoint.move("/source.txt", "/dest.txt");
				const result = await endpoint.readSingle("/dest.txt");
				const response = new Response(result.data);
				expect(await response.text()).toBe("new");
				expect(await endpoint.existsSingle("/source.txt")).toBe(false);
			});

			test("handles nested paths", async () => {
				await endpoint.writeSingle({
					path: "/dir1/source.txt",
					data: "content",
					mimeType: "text/plain",
				});
				await endpoint.move("/dir1/source.txt", "/dir2/dest.txt");
				expect(await endpoint.existsSingle("/dir2/dest.txt")).toBe(true);
				expect(await endpoint.existsSingle("/dir1/source.txt")).toBe(false);
			});
		});

		describe("getSignedDownloadUrl()", () => {
			test("handles downloadFileName parameter", async () => {
				await endpoint.writeSingle({
					path: "/test.txt",
					data: "content",
					mimeType: "text/plain",
				});
				const expires = new Date(Date.now() + 3600000);
				const url = await endpoint.getSignedDownloadUrl("/test.txt", expires, "custom.txt");
				expect(url).toInclude("custom");
			});
		});

		describe("getTemporaryUploadUrl()", () => {
			test("works for non-existent paths and nested paths", async () => {
				const expires = new Date(Date.now() + 3600000);
				const url1 = await endpoint.getTemporaryUploadUrl("/new-file.txt", expires);
				expect(url1).toInclude("new-file");

				const url2 = await endpoint.getTemporaryUploadUrl("/dir/subdir/test.txt", expires);
				expect(url2).toInclude("dir/subdir/test");
			});
		});

		describe("existsAnyUnderPrefix()", () => {
			test("handles various prefixes and deletion", async () => {
				await endpoint.writeSingle({
					path: "/a/b/c/file.txt",
					data: "content",
					mimeType: "text/plain",
				});
				expect(await endpoint.existsAnyUnderPrefix("/")).toBe(true);
				expect(await endpoint.existsAnyUnderPrefix("/a/")).toBe(true);
				expect(await endpoint.existsAnyUnderPrefix("/a/b/")).toBe(true);
				expect(await endpoint.existsAnyUnderPrefix("/a/b/c/")).toBe(true);

				await endpoint.deleteAllUnderPrefix("/a/b/c/");
				expect(await endpoint.existsAnyUnderPrefix("/")).toBe(false);
				expect(await endpoint.existsAnyUnderPrefix("/a/")).toBe(false);
				expect(await endpoint.existsAnyUnderPrefix("/a/b/")).toBe(false);
				expect(await endpoint.existsAnyUnderPrefix("/a/b/c/")).toBe(false);
			});
		});
	});
});

const URL_REGEX = /^[a-z]+(-[a-z]+)*:/;
