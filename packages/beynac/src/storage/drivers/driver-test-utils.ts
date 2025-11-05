import { beforeEach, describe, expect, test } from "bun:test";
import type { StorageDirectoryOperations, StorageDisk } from "../../contracts/Storage";

export const defineDriverTests = (init: () => StorageDisk): void => {
	let disk: StorageDisk;

	beforeEach(() => {
		disk = init();
	});

	// ============================================================
	// SECTION 1: StorageDisk
	// ============================================================
	describe("StorageDisk", () => {
		test.skip("has a name property", () => {
			expect(disk.name).toBe("test");
		});

		describe("StorageDirectoryOperations on disk", () => {
			testStorageDirectoryOperations(() => disk);
		});
	});

	// ============================================================
	// SECTION 2: StorageFile
	// ============================================================
	describe("StorageFile", () => {
		describe("delete()", () => {
			test.skip("deletes existing file without error", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "content", mimeType: "text/plain" });
				// await file.delete();
				// expect(await file.exists()).toBe(false);
			});

			test.skip("doesn't throw when file doesn't exist", async () => {
				// const file = disk.file("nonexistent.txt");
				// await expect(file.delete()).resolves.not.toThrow();
			});
		});

		describe("exists()", () => {
			test.skip("returns true for existing files", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "content", mimeType: "text/plain" });
				// expect(await file.exists()).toBe(true);
			});

			test.skip("returns false for non-existent files", async () => {
				// const file = disk.file("nonexistent.txt");
				// expect(await file.exists()).toBe(false);
			});
		});

		describe("fetch()", () => {
			test.skip("returns Response with correct body", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// const response = await file.fetch();
				// expect(await response.text()).toBe("hello");
			});

			test.skip("Fetches file as text/plain when uploaded as text/plain", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// const response = await file.fetch();
				// expect(response.headers.get("Content-Type")).toBe("text/plain");
			});

			test.skip("Fetches file as image/png when uploaded as image/png", async () => {
				// const file = disk.file("test.png");
				// await file.put({ data: "hello", mimeType: "image/png" });
				// const response = await file.fetch();
				// expect(response.headers.get("Content-Type")).toBe("image/png");
			});

			test.skip("Fetches file as image/png when uploaded as image/png with an incorrect extension", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "image/png" });
				// const response = await file.fetch();
				// expect(response.headers.get("Content-Type")).toBe("image/png");
			});

			test.skip("sets Content-Length header correctly", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// const response = await file.fetch();
				// expect(response.headers.get("Content-Length")).toBe("5");
			});

			test.skip("throws when file doesn't exist", async () => {
				// const file = disk.file("nonexistent.txt");
				// await expect(file.fetch()).rejects.toThrow();
			});

			test.skip("handles binary data correctly", async () => {
				// const file = disk.file("test.bin");
				// const data = new Uint8Array([1, 2, 3, 4]);
				// await file.put({ data, mimeType: "application/octet-stream" });
				// const response = await file.fetch();
				// const buffer = await response.arrayBuffer();
				// expect(new Uint8Array(buffer)).toEqual(data);
			});

			test.skip("response has ok=true status", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// const response = await file.fetch();
				// expect(response.ok).toBe(true);
			});

			test.skip("response body is streamable", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// const response = await file.fetch();
				// expect(response.body).toBeInstanceOf(ReadableStream);
			});

			test.skip("when supportsMimeTypes=false, infers type from extension", async () => {
				// Test with a driver that has supportsMimeTypes=false
			});
		});

		describe("info()", () => {
			test.skip("returns size, mimeType, etag for existing file", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// const info = await file.info();
				// expect(info).not.toBeNull();
				// expect(info!.size).toBe(5);
				// expect(info!.mimeType).toBe("text/plain");
				// expect(info!.etag).toBeDefined();
			});

			test.skip("returns null when file doesn't exist", async () => {
				// const file = disk.file("nonexistent.txt");
				// const info = await file.info();
				// expect(info).toBeNull();
			});

			test.skip("etag changes when file is modified", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// const info1 = await file.info();
				// await file.put({ data: "world", mimeType: "text/plain" });
				// const info2 = await file.info();
				// expect(info1!.etag).not.toBe(info2!.etag);
			});

			test.skip("size matches actual data size", async () => {
				// const file = disk.file("test.txt");
				// const data = "hello world";
				// await file.put({ data, mimeType: "text/plain" });
				// const info = await file.info();
				// expect(info!.size).toBe(data.length);
			});
		});

		describe("url()", () => {
			test.skip("generates accessible URL", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// const url = await file.url();
				// expect(url).toBeDefined();
			});

			test.skip("expires string patterns parsed correctly", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// const url = await file.url({ expires: "1h" });
				// expect(url).toBeDefined();
			});

			test.skip("expires Date object passed to endpoint", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// const expiryDate = new Date(Date.now() + 3600000);
				// const url = await file.url({ expires: expiryDate });
				// expect(url).toBeDefined();
			});

			test.skip("downloadAs option passed to endpoint correctly", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// const url = await file.url({ downloadAs: "custom-name.txt" });
				// expect(url).toBeDefined();
			});

			test.skip("URL without expiry works", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// const url = await file.url();
				// // Verify URL can be fetched
			});

			test.skip("generated URL can fetch the file", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// const url = await file.url();
				// const response = await fetch(url);
				// expect(await response.text()).toBe("hello");
			});

			test.skip("throws for non-existent file", async () => {
				// const file = disk.file("nonexistent.txt");
				// await expect(file.url()).rejects.toThrow();
			});
		});

		describe("uploadUrl()", () => {
			test.skip("generates valid upload URL", async () => {
				// const file = disk.file("test.txt");
				// const url = await file.uploadUrl();
				// expect(url).toBeDefined();
			});

			test.skip("expires string patterns parsed correctly", async () => {
				// const file = disk.file("test.txt");
				// const url = await file.uploadUrl({ expires: "1h" });
				// expect(url).toBeDefined();
			});

			test.skip("expires Date object handled correctly", async () => {
				// const file = disk.file("test.txt");
				// const expiryDate = new Date(Date.now() + 3600000);
				// const url = await file.uploadUrl({ expires: expiryDate });
				// expect(url).toBeDefined();
			});

			test.skip("can upload via generated URL", async () => {
				// const file = disk.file("test.txt");
				// const url = await file.uploadUrl();
				// // Upload via URL
				// // Verify file exists
			});

			test.skip("uploaded file is then accessible", async () => {
				// const file = disk.file("test.txt");
				// const url = await file.uploadUrl();
				// // Upload content
				// expect(await file.exists()).toBe(true);
			});
		});

		describe("put()", () => {
			test.skip("creates file with string data", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// expect(await file.exists()).toBe(true);
			});

			test.skip("creates file with Blob", async () => {
				// const file = disk.file("test.txt");
				// const blob = new Blob(["hello"]);
				// await file.put({ data: blob, mimeType: "text/plain" });
				// expect(await file.exists()).toBe(true);
			});

			test.skip("creates file with ArrayBuffer", async () => {
				// const file = disk.file("test.bin");
				// const buffer = new ArrayBuffer(8);
				// await file.put({ data: buffer, mimeType: "application/octet-stream" });
				// expect(await file.exists()).toBe(true);
			});

			test.skip("creates file with Uint8Array", async () => {
				// const file = disk.file("test.bin");
				// const data = new Uint8Array([1, 2, 3]);
				// await file.put({ data, mimeType: "application/octet-stream" });
				// expect(await file.exists()).toBe(true);
			});

			test.skip("creates file with ReadableStream", async () => {
				// const file = disk.file("test.txt");
				// const stream = new ReadableStream({
				//   start(controller) {
				//     controller.enqueue(new TextEncoder().encode("hello"));
				//     controller.close();
				//   }
				// });
				// await file.put({ data: stream, mimeType: "text/plain" });
				// expect(await file.exists()).toBe(true);
			});

			test.skip("creates file with File object", async () => {
				// const file = disk.file("dir/");
				// const fileObj = new File(["hello"], "test.txt", { type: "text/plain" });
				// const result = await file.put(fileObj);
				// // Should infer mimeType and suggestedName
				// expect(result.actualName).toBe("test.txt");
			});

			test.skip("creates file with Request object", async () => {
				// const file = disk.file("dir/");
				// const request = new Request("http://example.com", {
				//   method: "POST",
				//   body: "hello",
				//   headers: {
				//     "Content-Type": "text/plain",
				//     "X-File-Name": "test.txt"
				//   }
				// });
				// const result = await file.put(request);
				// // Should infer metadata from headers
				// expect(result.actualName).toBe("test.txt");
			});

			test.skip("overwrites existing file", async () => {
				// const file = disk.file("test.txt");
				// await file.put({ data: "hello", mimeType: "text/plain" });
				// await file.put({ data: "world", mimeType: "text/plain" });
				// const response = await file.fetch();
				// expect(await response.text()).toBe("world");
			});

			test.skip("returns actualName matching suggestedName when possible", async () => {
				// const file = disk.file("dir/");
				// const result = await file.put({
				//   data: "hello",
				//   mimeType: "text/plain",
				//   suggestedName: "test.txt"
				// });
				// expect(result.actualName).toBe("test.txt");
			});

			test.skip("when supportsMimeTypes=false, adjusts extension in actualName", async () => {
				// Test with a driver that has supportsMimeTypes=false
			});

			test.skip("actualPath matches directory + actualName", async () => {
				// const file = disk.file("dir/");
				// const result = await file.put({
				//   data: "hello",
				//   mimeType: "text/plain",
				//   suggestedName: "test.txt"
				// });
				// expect(result.actualPath).toBe("dir/test.txt");
			});

			test.skip("validates against invalidFilenameChars", async () => {
				// Test with a driver that has invalidFilenameChars
			});

			test.skip("generates name when suggestedName omitted", async () => {
				// const file = disk.file("dir/");
				// const result = await file.put({
				//   data: "hello",
				//   mimeType: "text/plain"
				// });
				// expect(result.actualName).toBeDefined();
			});
		});

		describe("copyTo()", () => {
			test.skip("copies within same disk using endpoint.copy()", async () => {
				// const source = disk.file("source.txt");
				// await source.put({ data: "hello", mimeType: "text/plain" });
				// const dest = disk.file("dest.txt");
				// await source.copyTo(dest);
				// expect(await dest.exists()).toBe(true);
				// const response = await dest.fetch();
				// expect(await response.text()).toBe("hello");
			});

			test.skip("copies to different disk", async () => {
				// const storage = new StorageImpl({
				//   disks: {
				//     disk1: memoryDriver({}),
				//     disk2: memoryDriver({})
				//   }
				// });
				// const source = storage.disk("disk1").file("source.txt");
				// await source.put({ data: "hello", mimeType: "text/plain" });
				// const dest = storage.disk("disk2").file("dest.txt");
				// await source.copyTo(dest);
				// expect(await dest.exists()).toBe(true);
			});

			test.skip("overwrites destination if exists", async () => {
				// const source = disk.file("source.txt");
				// await source.put({ data: "hello", mimeType: "text/plain" });
				// const dest = disk.file("dest.txt");
				// await dest.put({ data: "old", mimeType: "text/plain" });
				// await source.copyTo(dest);
				// const response = await dest.fetch();
				// expect(await response.text()).toBe("hello");
			});

			test.skip("preserves mimeType", async () => {
				// const source = disk.file("source.txt");
				// await source.put({ data: "hello", mimeType: "text/plain" });
				// const dest = disk.file("dest.txt");
				// await source.copyTo(dest);
				// const info = await dest.info();
				// expect(info!.mimeType).toBe("text/plain");
			});

			test.skip("throws when source doesn't exist", async () => {
				// const source = disk.file("nonexistent.txt");
				// const dest = disk.file("dest.txt");
				// await expect(source.copyTo(dest)).rejects.toThrow();
			});
		});
	});

	// ============================================================
	// SECTION 3: StorageDirectory
	// ============================================================
	describe("StorageDirectory", () => {
		describe.skip("StorageDirectoryOperations on directory", () => {
			// All directory operations tests applied to a subdirectory
			// testStorageDirectoryOperations(() => disk.directory("subdir"));
		});
	});

	// ============================================================
	// UTILITY FUNCTION
	// ============================================================
	// biome-ignore lint/correctness/noUnusedVariables: Will be used when tests are implemented
	function testStorageDirectoryOperations(getDirectory: () => StorageDirectoryOperations) {
		let dir = getDirectory();

		beforeEach(() => {
			dir = getDirectory();
		});

		describe("directory operations", () => {
			describe("exists()", () => {
				test.skip("returns true when directory has files", async () => {
					await dir.file("test.txt").put({ data: "hello", mimeType: "text/plain" });
					expect(await dir.exists()).toBe(true);
				});

				test.skip("returns false when directory is empty", async () => {
					// expect(await dir.exists()).toBe(false);
				});

				test.skip("returns false when no files with prefix", async () => {
					// // Put file in different directory
					// expect(await dir.exists()).toBe(false);
				});
			});

			describe("files()", () => {
				test.skip("lists immediate child files only", async () => {
					// await dir.file("file1.txt").put({ data: "1", mimeType: "text/plain" });
					// await dir.file("file2.txt").put({ data: "2", mimeType: "text/plain" });
					// await dir.file("sub/file3.txt").put({ data: "3", mimeType: "text/plain" });
					// const files = await dir.files();
					// expect(files.length).toBe(2);
				});

				test.skip("empty array for empty directory", async () => {
					// const files = await dir.files();
					// expect(files.length).toBe(0);
				});

				test.skip("doesn't include subdirectory files", async () => {
					// await dir.file("sub/file.txt").put({ data: "1", mimeType: "text/plain" });
					// const files = await dir.files();
					// expect(files.length).toBe(0);
				});

				test.skip("returns StorageFile objects with correct disk/path", async () => {
					// await dir.file("test.txt").put({ data: "hello", mimeType: "text/plain" });
					// const files = await dir.files();
					// expect(files[0].type).toBe("file");
					// expect(files[0].disk).toBe(dir.disk);
				});

				test.skip("handles paths correctly - no double slashes", async () => {
					// await dir.file("test.txt").put({ data: "hello", mimeType: "text/plain" });
					// const files = await dir.files();
					// expect(files[0].path).not.toContain("//");
				});
			});

			describe("allFiles()", () => {
				test.skip("lists all files recursively", async () => {
					// await dir.file("file1.txt").put({ data: "1", mimeType: "text/plain" });
					// await dir.file("sub/file2.txt").put({ data: "2", mimeType: "text/plain" });
					// await dir.file("sub/deep/file3.txt").put({ data: "3", mimeType: "text/plain" });
					// const files = await dir.allFiles();
					// expect(files.length).toBe(3);
				});

				test.skip("includes nested subdirectory files", async () => {
					// await dir.file("a/b/c/file.txt").put({ data: "1", mimeType: "text/plain" });
					// const files = await dir.allFiles();
					// expect(files.length).toBe(1);
				});

				test.skip("empty array for empty directory", async () => {
					// const files = await dir.allFiles();
					// expect(files.length).toBe(0);
				});

				test.skip("returns flattened list", async () => {
					// await dir.file("a/file1.txt").put({ data: "1", mimeType: "text/plain" });
					// await dir.file("b/file2.txt").put({ data: "2", mimeType: "text/plain" });
					// const files = await dir.allFiles();
					// expect(files.length).toBe(2);
				});

				test.skip("handles deep nesting correctly", async () => {
					// await dir.file("a/b/c/d/e/file.txt").put({ data: "1", mimeType: "text/plain" });
					// const files = await dir.allFiles();
					// expect(files.length).toBe(1);
				});
			});

			describe("directories()", () => {
				test.skip("lists immediate child directories only", async () => {
					// await dir.file("sub1/file.txt").put({ data: "1", mimeType: "text/plain" });
					// await dir.file("sub2/file.txt").put({ data: "2", mimeType: "text/plain" });
					// await dir.file("sub1/deep/file.txt").put({ data: "3", mimeType: "text/plain" });
					// const dirs = await dir.directories();
					// expect(dirs.length).toBe(2);
				});

				test.skip("empty array when no subdirectories", async () => {
					// await dir.file("file.txt").put({ data: "1", mimeType: "text/plain" });
					// const dirs = await dir.directories();
					// expect(dirs.length).toBe(0);
				});

				test.skip("doesn't include nested subdirectories", async () => {
					// await dir.file("sub/deep/file.txt").put({ data: "1", mimeType: "text/plain" });
					// const dirs = await dir.directories();
					// expect(dirs.length).toBe(1); // Only "sub"
				});

				test.skip("returns StorageDirectory objects with correct disk/path", async () => {
					// await dir.file("sub/file.txt").put({ data: "1", mimeType: "text/plain" });
					// const dirs = await dir.directories();
					// expect(dirs[0].type).toBe("directory");
					// expect(dirs[0].disk).toBe(dir.disk);
				});

				test.skip("paths end with trailing slash", async () => {
					// await dir.file("sub/file.txt").put({ data: "1", mimeType: "text/plain" });
					// const dirs = await dir.directories();
					// expect(dirs[0].path).toEndWith("/");
				});
			});

			describe("allDirectories()", () => {
				test.skip("lists all directories recursively", async () => {
					// await dir.file("a/file.txt").put({ data: "1", mimeType: "text/plain" });
					// await dir.file("a/b/file.txt").put({ data: "2", mimeType: "text/plain" });
					// await dir.file("a/b/c/file.txt").put({ data: "3", mimeType: "text/plain" });
					// const dirs = await dir.allDirectories();
					// expect(dirs.length).toBe(3); // a, a/b, a/b/c
				});

				test.skip("includes deeply nested directories", async () => {
					// await dir.file("a/b/c/d/e/file.txt").put({ data: "1", mimeType: "text/plain" });
					// const dirs = await dir.allDirectories();
					// expect(dirs.length).toBe(5); // a, a/b, a/b/c, a/b/c/d, a/b/c/d/e
				});

				test.skip("empty array when no subdirectories", async () => {
					// await dir.file("file.txt").put({ data: "1", mimeType: "text/plain" });
					// const dirs = await dir.allDirectories();
					// expect(dirs.length).toBe(0);
				});

				test.skip("returns flattened list", async () => {
					// await dir.file("a/b/file.txt").put({ data: "1", mimeType: "text/plain" });
					// await dir.file("c/d/file.txt").put({ data: "2", mimeType: "text/plain" });
					// const dirs = await dir.allDirectories();
					// expect(dirs.length).toBe(4); // a, a/b, c, c/d
				});

				test.skip("all paths end with trailing slash", async () => {
					// await dir.file("a/b/file.txt").put({ data: "1", mimeType: "text/plain" });
					// const dirs = await dir.allDirectories();
					// dirs.forEach(d => expect(d.path).toEndWith("/"));
				});
			});

			describe("deleteAll()", () => {
				test.skip("deletes all files in directory", async () => {
					// await dir.file("file1.txt").put({ data: "1", mimeType: "text/plain" });
					// await dir.file("file2.txt").put({ data: "2", mimeType: "text/plain" });
					// await dir.deleteAll();
					// const files = await dir.allFiles();
					// expect(files.length).toBe(0);
				});

				test.skip("deletes files in subdirectories recursively", async () => {
					// await dir.file("a/b/c/file.txt").put({ data: "1", mimeType: "text/plain" });
					// await dir.deleteAll();
					// const files = await dir.allFiles();
					// expect(files.length).toBe(0);
				});

				test.skip("directory.exists() returns false after deleteAll", async () => {
					// await dir.file("file.txt").put({ data: "1", mimeType: "text/plain" });
					// await dir.deleteAll();
					// expect(await dir.exists()).toBe(false);
				});

				test.skip("doesn't throw when directory already empty", async () => {
					// await expect(dir.deleteAll()).resolves.not.toThrow();
				});
			});

			describe("directory()", () => {
				test.skip("resolves relative path correctly", async () => {
					// const subdir = dir.directory("subdir");
					// expect(subdir.path).toContain("subdir/");
				});

				test.skip("leading slash optional", async () => {
					// const subdir1 = dir.directory("subdir");
					// const subdir2 = dir.directory("/subdir");
					// expect(subdir1.path).toBe(subdir2.path);
				});

				test.skip("trailing slash optional - added if missing", async () => {
					// const subdir = dir.directory("subdir");
					// expect(subdir.path).toEndWith("/");
				});

				test.skip("handles nested paths", async () => {
					// const subdir = dir.directory("a/b/c");
					// expect(subdir.path).toContain("a/b/c/");
				});

				test.skip("returned path is relative to parent", async () => {
					// const subdir = dir.directory("sub");
					// // Verify it's under parent
				});

				test.skip("doesn't check if directory exists", async () => {
					// expect(() => dir.directory("nonexistent")).not.toThrow();
				});
			});

			describe("file()", () => {
				test.skip("resolves relative path correctly", async () => {
					// const file = dir.file("test.txt");
					// expect(file.path).toContain("test.txt");
				});

				test.skip("leading slash optional", async () => {
					// const file1 = dir.file("test.txt");
					// const file2 = dir.file("/test.txt");
					// expect(file1.path).toBe(file2.path);
				});

				test.skip("trailing slash removed if present", async () => {
					// const file = dir.file("test.txt/");
					// expect(file.path).not.toEndWith("/");
				});

				test.skip("handles nested paths", async () => {
					// const file = dir.file("a/b/c/test.txt");
					// expect(file.path).toContain("a/b/c/test.txt");
				});

				test.skip("doesn't check if file exists", async () => {
					// expect(() => dir.file("nonexistent.txt")).not.toThrow();
				});
			});
		});
	}
};
