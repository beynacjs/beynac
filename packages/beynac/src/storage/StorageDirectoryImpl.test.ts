import { describe, expect, mock, test } from "bun:test";
import { memoryStorage } from "./drivers/memory/MemoryStorageDriver";
import { StorageDirectoryImpl } from "./StorageDirectoryImpl";
import { StorageDiskImpl } from "./StorageDiskImpl";
import { StorageFileImpl } from "./StorageFileImpl";
import { mockStorageEndpoint } from "./test-helpers";

describe(StorageDirectoryImpl, () => {
	const endpoint = memoryStorage({});
	const disk = new StorageDiskImpl("test", endpoint);

	describe("constructor", () => {
		test("stores path with leading slash and adds trailing slash", () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/path/to/dir");
			expect(dir.path).toBe("/path/to/dir/");
			expect(dir.disk).toBe(disk);
		});

		test("adds trailing slash if missing", () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/path/to/dir");
			expect(dir.path).toBe("/path/to/dir/");
		});

		test("preserves existing trailing slash", () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/path/to/dir/");
			expect(dir.path).toBe("/path/to/dir/");
		});

		test('root path "/" is preserved', () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/");
			expect(dir.path).toBe("/");
		});
	});

	describe("exists()", () => {
		test("delegates to endpoint.existsAnyUnderPrefix with correct path", async () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.existsAnyUnderPrefix = mock(async () => true);
			const dir = new StorageDirectoryImpl(disk, mockEndpoint, "/subdir/");
			const result = await dir.exists();
			expect(result).toBe(true);
			expect(mockEndpoint.existsAnyUnderPrefix).toHaveBeenCalledWith("/subdir/");
		});
	});

	describe("files()", () => {
		test("delegates to endpoint.listFiles with recursive=false", async () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.listFiles = mock(async () => ["/subdir/file1.txt", "/subdir/file2.txt"]);
			const dir = new StorageDirectoryImpl(disk, mockEndpoint, "/subdir/");
			const result = await dir.files();
			expect(mockEndpoint.listFiles).toHaveBeenCalledWith("/subdir/", false);
			expect(result.length).toBe(2);
			expect(result[0]).toBeInstanceOf(StorageFileImpl);
			expect(result[0].path).toBe("/subdir/file1.txt");
		});
	});

	describe("allFiles()", () => {
		test("delegates to endpoint.listFiles with recursive=true", async () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.listFiles = mock(async () => ["/subdir/a.txt", "/subdir/sub/b.txt"]);
			const dir = new StorageDirectoryImpl(disk, mockEndpoint, "/subdir/");
			const result = await dir.allFiles();
			expect(mockEndpoint.listFiles).toHaveBeenCalledWith("/subdir/", true);
			expect(result.length).toBe(2);
		});
	});

	describe("directories()", () => {
		test("delegates to endpoint.listDirectories with recursive=false", async () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.listDirectories = mock(async () => ["/subdir/a/", "/subdir/b/"]);
			const dir = new StorageDirectoryImpl(disk, mockEndpoint, "/subdir/");
			const result = await dir.directories();
			expect(mockEndpoint.listDirectories).toHaveBeenCalledWith("/subdir/", false);
			expect(result.length).toBe(2);
			expect(result[0]).toBeInstanceOf(StorageDirectoryImpl);
			expect(result[0].path).toBe("/subdir/a/");
		});
	});

	describe("allDirectories()", () => {
		test("delegates to endpoint.listDirectories with recursive=true", async () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.listDirectories = mock(async () => ["/subdir/a/", "/subdir/a/b/"]);
			const dir = new StorageDirectoryImpl(disk, mockEndpoint, "/subdir/");
			const result = await dir.allDirectories();
			expect(mockEndpoint.listDirectories).toHaveBeenCalledWith("/subdir/", true);
			expect(result.length).toBe(2);
		});
	});

	describe("deleteAll()", () => {
		test("delegates to endpoint.deleteAllUnderPrefix with correct path", async () => {
			const mockEndpoint = mockStorageEndpoint();
			const dir = new StorageDirectoryImpl(disk, mockEndpoint, "/subdir/");
			await dir.deleteAll();
			expect(mockEndpoint.deleteAllUnderPrefix).toHaveBeenCalledWith("/subdir/");
		});
	});

	describe("directory()", () => {
		test("creates nested directory with joined path", () => {
			const dir = new StorageDirectoryImpl(disk, endpoint, "/parent/");
			const subdir = dir.directory("child");
			expect(subdir.path).toBe("/parent/child/");
		});

		test("removes leading slash from child path", () => {
			const dir = new StorageDirectoryImpl(disk, endpoint, "/parent/");
			const subdir = dir.directory("/child");
			expect(subdir.path).toBe("/parent/child/");
		});

		test("adds trailing slash if missing", () => {
			const dir = new StorageDirectoryImpl(disk, endpoint, "/parent/");
			const subdir = dir.directory("child");
			expect(subdir.path).toEndWith("/");
		});

		test("creates nested directories from slash-separated path", () => {
			const dir = new StorageDirectoryImpl(disk, endpoint, "/parent/");
			const subdir = dir.directory("a/b/c");
			expect(subdir.path).toBe("/parent/a/b/c/");
		});

		test("from root directory creates correct path with leading slash", () => {
			const root = new StorageDirectoryImpl(disk, endpoint, "/");
			const dir = root.directory("subdir");
			expect(dir.path).toBe("/subdir/");
		});

		test('returns same directory when passed "/"', () => {
			const dir = new StorageDirectoryImpl(disk, endpoint, "/parent/");
			const same = dir.directory("/");
			expect(same).toBe(dir);
		});

		test('returns same directory when passed "" or "/"', () => {
			const dir = new StorageDirectoryImpl(disk, endpoint, "/parent/");
			expect(dir.directory("")).toBe(dir);
			expect(dir.directory("/")).toBe(dir);
		});

		test("sanitizes each path segment individually", () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.invalidNameChars = "<>";
			const dir = new StorageDirectoryImpl(disk, mockEndpoint, "/parent/");
			const subdir = dir.directory("a<b/c>d");
			expect(subdir.path).toBe("/parent/a_b/c_d/");
		});
	});

	describe("file()", () => {
		test("creates file with joined path", () => {
			const dir = new StorageDirectoryImpl(disk, endpoint, "/parent/");
			const file = dir.file("test.txt");
			expect(file.path).toBe("/parent/test.txt");
			expect(file).toBeInstanceOf(StorageFileImpl);
		});

		test("removes leading slash from file path", () => {
			const dir = new StorageDirectoryImpl(disk, endpoint, "/parent/");
			const file = dir.file("/test.txt");
			expect(file.path).toBe("/parent/test.txt");
		});

		test("removes trailing slash from file path", () => {
			const dir = new StorageDirectoryImpl(disk, endpoint, "/parent/");
			const file = dir.file("test.txt/");
			expect(file.path).toBe("/parent/test.txt");
		});

		test("from root directory creates correct path with leading slash", () => {
			const root = new StorageDirectoryImpl(disk, endpoint, "/");
			const file = root.file("test.txt");
			expect(file.path).toBe("/test.txt");
		});

		test("sanitizes invalid characters in filename", () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.invalidNameChars = "<>:";
			const dir = new StorageDirectoryImpl(disk, mockEndpoint, "/parent/");
			const file = dir.file("my<file>:test.txt");
			expect(file.path).toBe("/parent/my_file_test.txt");
		});

		test("sanitizes slashes in filename preserving path structure", () => {
			const mockEndpoint = mockStorageEndpoint();
			mockEndpoint.invalidNameChars = "/";
			const dir = new StorageDirectoryImpl(disk, mockEndpoint, "/parent/");
			const file = dir.file("a/b/c");
			expect(file.path).toBe("/parent/a/b/c");
		});
	});

	describe("putFile()", () => {
		test("creates file from File object and extracts name and mime type", async () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/uploads/");
			const fileObj = new File(["content"], "document.txt", {
				type: "text/plain",
			});
			const file = await dir.putFile(fileObj);

			expect(file.path).toBe("/uploads/document.txt");
			expect(await file.exists()).toBe(true);
			const response = await file.fetch();
			expect(await response.text()).toBe("content");
		});

		test("creates file from Request object and extracts metadata from headers", async () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/uploads/");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "content",
				headers: {
					"Content-Type": "text/plain",
					"X-File-Name": "request-file.txt",
				},
			});
			const file = await dir.putFile(request);

			expect(file.path).toBe("/uploads/request-file.txt");
			expect(await file.exists()).toBe(true);
		});

		test("trims whitespace from File object name", async () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/uploads/");
			const fileObj = new File(["content"], "  document.txt  ", {
				type: "text/plain",
			});
			const file = await dir.putFile(fileObj);

			expect(file.path).toBe("/uploads/document.txt");
		});

		test("trims whitespace from Request X-File-Name header", async () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/uploads/");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "content",
				headers: {
					"Content-Type": "text/plain",
					"X-File-Name": "  request-file.txt  ",
				},
			});
			const file = await dir.putFile(request);

			expect(file.path).toBe("/uploads/request-file.txt");
		});

		test("takes basename when File name contains slashes", async () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/uploads/");
			const fileObj = new File(["content"], "../../etc/passwd", {
				type: "text/plain",
			});
			const file = await dir.putFile(fileObj);

			expect(file.path).toBe("/uploads/passwd");
		});

		test("takes basename when Request X-File-Name contains slashes", async () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/uploads/");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "content",
				headers: {
					"Content-Type": "text/plain",
					"X-File-Name": "/var/www/evil.php",
				},
			});
			const file = await dir.putFile(request);

			expect(file.path).toBe("/uploads/evil.php");
		});

		test("uses Content-Disposition filename when X-File-Name is not present", async () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/uploads/");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "content",
				headers: {
					"Content-Type": "text/plain",
					"Content-Disposition": 'attachment; filename="download.txt"',
				},
			});
			const file = await dir.putFile(request);

			expect(file.path).toBe("/uploads/download.txt");
		});

		test("trims whitespace from Content-Disposition filename", async () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/uploads/");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "content",
				headers: {
					"Content-Type": "text/plain",
					"Content-Disposition": 'attachment; filename="  download.txt  "',
				},
			});
			const file = await dir.putFile(request);

			expect(file.path).toBe("/uploads/download.txt");
		});

		test("generates random filename when no suggestedName provided", async () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/uploads/");
			const file = await dir.putFile({
				data: "content",
				mimeType: "text/plain",
			});

			expect(file.path).toStartWith("/uploads/");
			expect(file.path.length).toBeGreaterThan("/uploads/".length);
		});

		test("uses suggestedName from payload when provided", async () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/uploads/");
			const file = await dir.putFile({
				data: "content",
				mimeType: "text/plain",
				suggestedName: "custom.txt",
			});

			expect(file.path).toBe("/uploads/custom.txt");
		});
	});

	describe("toString()", () => {
		test("returns [StorageDirectoryImpl endpoint://path]", () => {
			const endpoint = memoryStorage({ name: "test-endpoint" });
			const disk = new StorageDiskImpl("test", endpoint);
			const dir = new StorageDirectoryImpl(disk, endpoint, "/path/to/dir/");
			expect(dir.toString()).toBe("[StorageDirectoryImpl test-endpoint://path/to/dir/]");
		});
	});
});
