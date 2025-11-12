import { beforeEach, describe, expect, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl";
import type { Dispatcher } from "../contracts/Dispatcher";
import type { StorageDirectory, StorageEndpoint } from "../contracts/Storage";
import { DispatcherImpl } from "../core/DispatcherImpl";
import { expectErrorWithProperties, mockDispatcher } from "../test-utils";
import { memoryStorage } from "./drivers/memory/MemoryStorageDriver";
import { StorageDirectoryImpl } from "./StorageDirectoryImpl";
import { StorageDiskImpl } from "./StorageDiskImpl";
import { StorageFileImpl } from "./StorageFileImpl";
import { InvalidPathError } from "./storage-errors";
import {
	DirectoryDeletedEvent,
	DirectoryDeletingEvent,
	DirectoryDirectoriesListedEvent,
	DirectoryExistenceCheckedEvent,
	DirectoryExistenceCheckingEvent,
	DirectoryFilesListedEvent,
	DirectoryListingDirectoriesEvent,
	DirectoryListingFilesEvent,
	FileWritingEvent,
	FileWrittenEvent,
} from "./storage-events";
import { mockCurrentTime } from "../testing";

function getPaths(items: Array<{ path: string }>): string[] {
	return items.map((item) => item.path);
}

describe(StorageDirectoryImpl, () => {
	let endpoint: StorageEndpoint;
	let disk: StorageDiskImpl;
	let dispatcher: Dispatcher;

	beforeEach(() => {
		endpoint = memoryStorage({
			initialFiles: {
				"/subdir/file1.txt": "file 1",
				"/subdir/file2.txt": "file 2",
				"/subdir/a/file.txt": "a file",
				"/subdir/b/file.txt": "b file",
				"/subdir/a/nested.txt": "nested",
				"/subdir/a/b/deep.txt": "deep",
			},
		});
		dispatcher = new DispatcherImpl(new ContainerImpl());
		disk = new StorageDiskImpl("test", endpoint, dispatcher);
	});

	const create = (path: string, ep = endpoint): StorageDirectory => {
		return new StorageDirectoryImpl(disk, ep, path, mockDispatcher());
	};

	describe("constructor", () => {
		test("stores disk and path", () => {
			const dir = create("/path/to/dir/");
			expect(dir.disk).toBe(disk);
			expect(dir.path).toBe("/path/to/dir/");
		});

		test("throws when trailing slash is missing", () => {
			expectErrorWithProperties(() => create("/path/to/dir"), InvalidPathError, {
				path: "/path/to/dir",
				reason: "directory paths must start and end with a slash",
			});
		});

		test("throws when leading slash is missing", () => {
			expect(() => create("path/to/dir/")).toThrow(InvalidPathError);
		});

		test('root path "/" is valid', () => {
			const dir = create("/");
			expect(dir.path).toBe("/");
		});
	});

	describe("exists()", () => {
		test("returns true when directory contains files", async () => {
			const dir = create("/subdir/");
			const result = await dir.exists();
			expect(result).toBe(true);
		});
	});

	describe("files()", () => {
		test("returns files directly in directory", async () => {
			const dir = create("/subdir/");
			expect(getPaths(await dir.files())).toEqual(["/subdir/file1.txt", "/subdir/file2.txt"]);
		});
	});

	describe("allFiles()", () => {
		test("returns all files recursively", async () => {
			const dir = create("/subdir/");
			expect(getPaths(await dir.allFiles())).toEqual([
				"/subdir/a/b/deep.txt",
				"/subdir/a/file.txt",
				"/subdir/a/nested.txt",
				"/subdir/b/file.txt",
				"/subdir/file1.txt",
				"/subdir/file2.txt",
			]);
		});
	});

	describe("directories()", () => {
		test("returns direct subdirectories", async () => {
			const dir = create("/subdir/");
			expect(getPaths(await dir.directories())).toEqual(["/subdir/a/", "/subdir/b/"]);
		});
	});

	describe("allDirectories()", () => {
		test("returns all subdirectories recursively", async () => {
			const dir = create("/subdir/");
			expect(getPaths(await dir.allDirectories())).toEqual([
				"/subdir/a/",
				"/subdir/a/b/",
				"/subdir/b/",
			]);
		});
	});

	describe("deleteAll()", () => {
		test("deletes all files under prefix", async () => {
			const dir = create("/subdir/");
			await dir.deleteAll();
			expect(await dir.exists()).toBe(false);
		});
	});

	describe("directory()", () => {
		test("creates nested directory with joined path", () => {
			const dir = create("/parent/");
			const subdir = dir.directory("child");
			expect(subdir.path).toBe("/parent/child/");
		});

		test("removes leading slash from child path", () => {
			const dir = create("/parent/");
			const subdir = dir.directory("/child");
			expect(subdir.path).toBe("/parent/child/");
		});

		test("adds trailing slash if missing", () => {
			const dir = create("/parent/");
			const subdir = dir.directory("child");
			expect(subdir.path).toEndWith("/");
		});

		test("creates nested directories from slash-separated path", () => {
			const dir = create("/parent/");
			const subdir = dir.directory("a/b/c");
			expect(subdir.path).toBe("/parent/a/b/c/");
		});

		test("from root directory creates correct path with leading slash", () => {
			const root = create("/");
			const dir = root.directory("subdir");
			expect(dir.path).toBe("/subdir/");
		});

		test('returns same directory when passed "/"', () => {
			const dir = create("/parent/");
			const same = dir.directory("/");
			expect(same).toBe(dir);
		});

		test('returns same directory when passed "" or "/"', () => {
			const dir = create("/parent/");
			expect(dir.directory("")).toBe(dir);
			expect(dir.directory("/")).toBe(dir);
		});

		test("sanitises each path segment individually", () => {
			const sanitisingEndpoint = memoryStorage({
				invalidNameChars: "<>",
			});
			const dir = create("/parent/", sanitisingEndpoint);
			const subdir = dir.directory("a<<b/c>>d");
			expect(subdir.path).toBe("/parent/a_b-1821dbf7/c_d-b01a45d3/");
		});

		test("converts when onInvalid is 'convert' or not provided", () => {
			const sanitisingEndpoint = memoryStorage({
				invalidNameChars: "<>",
			});
			const dir = create("/parent/", sanitisingEndpoint);

			// Default behavior (no options)
			const subdir1 = dir.directory("a<<b");
			expect(subdir1.path).toBe("/parent/a_b-1821dbf7/");

			// Explicit convert
			const subdir2 = dir.directory("a<<b", { onInvalid: "convert" });
			expect(subdir2.path).toBe("/parent/a_b-1821dbf7/");
		});

		test("throws when onInvalid is 'throw' and path has invalid chars", () => {
			const sanitisingEndpoint = memoryStorage({
				invalidNameChars: "<>",
			});
			const dir = create("/parent/", sanitisingEndpoint);

			expect(() => dir.directory("a<<b", { onInvalid: "throw" })).toThrow(InvalidPathError);

			expectErrorWithProperties(
				() => dir.directory("a<<b", { onInvalid: "throw" }),
				InvalidPathError,
				{
					path: "/parent/a<<b",
					reason: "memory driver does not allow <> in names",
				},
			);
		});
	});

	describe("file()", () => {
		test("creates file with joined path", () => {
			const dir = create("/parent/");
			const file = dir.file("test.txt");
			expect(file.path).toBe("/parent/test.txt");
			expect(file).toBeInstanceOf(StorageFileImpl);
		});

		test("removes leading slash from file path", () => {
			const dir = create("/parent/");
			const file = dir.file("/test.txt");
			expect(file.path).toBe("/parent/test.txt");
		});

		test("removes trailing slash from file path", () => {
			const dir = create("/parent/");
			const file = dir.file("test.txt/");
			expect(file.path).toBe("/parent/test.txt");
		});

		test("throws when filename is empty", () => {
			const dir = create("/parent/");
			expectErrorWithProperties(() => dir.file(""), InvalidPathError, {
				path: "",
				reason: "file name cannot be empty",
			});
		});

		test("from root directory creates correct path with leading slash", () => {
			const root = create("/");
			const file = root.file("test.txt");
			expect(file.path).toBe("/test.txt");
		});

		test("sanitises invalid characters in filename", () => {
			const sanitisingEndpoint = memoryStorage({
				invalidNameChars: "<>:",
			});
			const dir = create("/parent/", sanitisingEndpoint);
			const file = dir.file("my<<file>>:test.txt");
			expect(file.path).toBe("/parent/my_file_test-cdcb6c02.txt");
		});

		test("converts when onInvalid is 'convert' or not provided", () => {
			const sanitisingEndpoint = memoryStorage({
				invalidNameChars: "<>:",
			});
			const dir = create("/parent/", sanitisingEndpoint);

			// Default behavior (no options)
			const file1 = dir.file("my<<file>>:test.txt");
			expect(file1.path).toBe("/parent/my_file_test-cdcb6c02.txt");

			// Explicit convert
			const file2 = dir.file("my<<file>>:test.txt", { onInvalid: "convert" });
			expect(file2.path).toBe("/parent/my_file_test-cdcb6c02.txt");
		});

		test("throws when onInvalid is 'throw' and filename has invalid chars", () => {
			const sanitisingEndpoint = memoryStorage({
				invalidNameChars: "<>:",
			});
			const dir = create("/parent/", sanitisingEndpoint);

			expect(() => dir.file("my<<file>>:test.txt", { onInvalid: "throw" })).toThrow(
				InvalidPathError,
			);
		});

		test("sanitises slashes in filename preserving path structure", () => {
			const sanitisingEndpoint = memoryStorage({
				invalidNameChars: "/",
			});
			const dir = create("/parent/", sanitisingEndpoint);
			const file = dir.file("a/b/c");
			expect(file.path).toBe("/parent/a/b/c");
		});
	});

	describe("putFile()", () => {
		test("creates file from File object and extracts name and mime type", async () => {
			const dir = create("/uploads/");
			const fileObj = new File(["content"], "document", {
				type: "text/html; charset=utf-8",
			});
			const file = await dir.putFile(fileObj);

			expect(file.path).toBe("/uploads/document");
			expect(await file.exists()).toBe(true);
			const response = await file.fetch();
			expect(await response.text()).toBe("content");
			expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		});

		test("creates file from Request object and extracts metadata from headers", async () => {
			const dir = create("/uploads/");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "content",
				headers: {
					"Content-Type": "text/html",
					"X-File-Name": "request-file",
				},
			});
			const file = await dir.putFile(request);

			expect(file.path).toBe("/uploads/request-file");
			const response = await file.fetch();
			expect(await response.text()).toBe("content");
			expect(response.headers.get("Content-Type")).toBe("text/html");
		});

		test("trims whitespace from File object name", async () => {
			const dir = create("/uploads/");
			const fileObj = new File(["content"], "  document.txt  ", {
				type: "text/plain",
			});
			const file = await dir.putFile(fileObj);

			expect(file.path).toBe("/uploads/document.txt");
		});

		test("trims whitespace from Request X-File-Name header", async () => {
			const dir = create("/uploads/");
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
			const dir = create("/uploads/");
			const fileObj = new File(["content"], "../../etc/passwd", {
				type: "text/plain",
			});
			const file = await dir.putFile(fileObj);

			expect(file.path).toBe("/uploads/passwd");
		});

		test("takes basename when Request X-File-Name contains slashes", async () => {
			const dir = create("/uploads/");
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
			const dir = create("/uploads/");
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
			const dir = create("/uploads/");
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
			const dir = create("/uploads/");
			const file = await dir.putFile({
				data: "content",
				mimeType: "text/plain",
			});

			expect(file.path).toStartWith("/uploads/");
			expect(file.path.length).toBeGreaterThan("/uploads/".length);
		});

		test("uses suggestedName from payload when provided", async () => {
			const dir = create("/uploads/");
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
			const dir = create("/path/to/dir/", endpoint);
			expect(dir.toString()).toBe("[StorageDirectoryImpl test-endpoint://path/to/dir/]");
		});
	});

	describe("events", () => {
		let eventDisk: StorageDiskImpl;
		let eventDispatcher: ReturnType<typeof mockDispatcher>;

		beforeEach(() => {
			mockCurrentTime();
			eventDispatcher = mockDispatcher();
			eventDisk = new StorageDiskImpl("event-test", endpoint, eventDispatcher);
		});

		test("exists() dispatches directory:existence-check events once", async () => {
			const dir = eventDisk.directory("subdir");

			const exists = await dir.exists();

			const startEvent = new DirectoryExistenceCheckingEvent(eventDisk, "/subdir/");
			const endEvent = new DirectoryExistenceCheckedEvent(startEvent, exists);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("files() dispatches directory:files-list events once", async () => {
			const dir = eventDisk.directory("subdir");

			const files = await dir.files();

			const startEvent = new DirectoryListingFilesEvent(eventDisk, "/subdir/", false);
			const endEvent = new DirectoryFilesListedEvent(startEvent, files);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("allFiles() dispatches directory:files-list events once", async () => {
			const dir = eventDisk.directory("subdir");

			const files = await dir.allFiles();

			const startEvent = new DirectoryListingFilesEvent(eventDisk, "/subdir/", true);
			const endEvent = new DirectoryFilesListedEvent(startEvent, files);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("directories() dispatches directory:directories-list events once", async () => {
			const dir = eventDisk.directory("subdir");

			const directories = await dir.directories();

			const startEvent = new DirectoryListingDirectoriesEvent(eventDisk, "/subdir/", false);
			const endEvent = new DirectoryDirectoriesListedEvent(startEvent, directories);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("allDirectories() dispatches directory:directories-list events once", async () => {
			const dir = eventDisk.directory("subdir");

			const directories = await dir.allDirectories();

			const startEvent = new DirectoryListingDirectoriesEvent(eventDisk, "/subdir/", true);
			const endEvent = new DirectoryDirectoriesListedEvent(startEvent, directories);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("deleteAll() dispatches directory:delete events once", async () => {
			const dir = eventDisk.directory("subdir");

			await dir.deleteAll();

			const startEvent = new DirectoryDeletingEvent(eventDisk, "/subdir/");
			const endEvent = new DirectoryDeletedEvent(startEvent);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("putFile() dispatches file:write events only", async () => {
			const dir = eventDisk.directory("uploads");

			const data = "content";
			await dir.putFile({ data, mimeType: "text/plain", suggestedName: "test.txt" });

			const startEvent = new FileWritingEvent(eventDisk, "/uploads/test.txt", data, "text/plain");
			const endEvent = new FileWrittenEvent(startEvent);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});
	});
});
