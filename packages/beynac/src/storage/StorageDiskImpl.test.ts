import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { StorageDirectoryOperations } from "../contracts/Storage";
import { spyOnAll } from "../test-utils";
import { memoryStorage } from "./drivers/memory/MemoryStorageDriver";
import { StorageDirectoryImpl } from "./StorageDirectoryImpl";
import { StorageDiskImpl } from "./StorageDiskImpl";

describe(StorageDiskImpl, () => {
	describe("constructor", () => {
		test("stores name and endpoint correctly", () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test-disk", endpoint);
			expect(disk.name).toBe("test-disk");
		});
	});

	describe("file()", () => {
		test("creates StorageFileImpl with correct params and leading slash", () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test-disk", endpoint);
			const file = disk.file("path/to/file.txt");
			expect(file.path).toBe("/path/to/file.txt");
		});

		test("normalises file path and adds leading slash", () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test-disk", endpoint);
			const file = disk.file("path/to/file.txt/");
			expect(file.path).toBe("/path/to/file.txt");
		});
	});

	describe("directory()", () => {
		test("creates StorageDirectoryImpl with correct params and leading slash", () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test-disk", endpoint);
			const dir = disk.directory("path/to/dir");
			expect(dir.path).toBe("/path/to/dir/");
		});

		test("normalises directory path with leading and trailing slash", () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("test-disk", endpoint);
			const dir = disk.directory("path/to/dir");
			expect(dir.path).toBe("/path/to/dir/");
		});
	});

	describe("directory operations delegation", () => {
		let mockRoot: StorageDirectoryOperations;
		let disk: StorageDiskImpl;

		beforeEach(() => {
			const endpoint = memoryStorage({});
			disk = new StorageDiskImpl("test-disk", endpoint);
			mockRoot = spyOnAll(new StorageDirectoryImpl(disk, endpoint, "/"));
			// Override getDirectoryForDelegation to return our mock
			(disk as any).getDirectoryForDelegation = mock(() => mockRoot);
		});

		test("disk.exists() delegates to root directory", async () => {
			await disk.exists();
			expect(mockRoot.exists).toHaveBeenCalled();
		});

		test("disk.files() delegates to root directory", async () => {
			await disk.files();
			expect(mockRoot.files).toHaveBeenCalled();
		});

		test("disk.allFiles() delegates to root directory", async () => {
			await disk.allFiles();
			expect(mockRoot.allFiles).toHaveBeenCalled();
		});

		test("disk.directories() delegates to root directory", async () => {
			await disk.directories();
			expect(mockRoot.directories).toHaveBeenCalled();
		});

		test("disk.allDirectories() delegates to root directory", async () => {
			await disk.allDirectories();
			expect(mockRoot.allDirectories).toHaveBeenCalled();
		});

		test("disk.deleteAll() delegates to root directory", async () => {
			await disk.deleteAll();
			expect(mockRoot.deleteAll).toHaveBeenCalled();
		});

		test("disk.directory(path) delegates to root directory with path", () => {
			disk.directory("subdir");
			expect(mockRoot.directory).toHaveBeenCalledWith("subdir");
		});

		test("disk.file(path) delegates to root directory with path", () => {
			disk.file("test.txt");
			expect(mockRoot.file).toHaveBeenCalledWith("test.txt");
		});
	});

	describe("path handling integration", () => {
		test("disk operations work on root path", async () => {
			const endpoint = memoryStorage({
				initialFiles: {
					"/test.txt": "root file",
					"/subdir/nested.txt": "nested file",
				},
			});
			const disk = new StorageDiskImpl("test-disk", endpoint);

			const file = disk.file("test.txt");
			expect(await file.exists()).toBe(true);
			const response = await file.fetch();
			expect(await response.text()).toBe("root file");

			const dir = disk.directory("subdir");
			const files = await dir.files();
			expect(files.length).toBe(1);
			expect(files[0].path).toBe("/subdir/nested.txt");
		});
	});

	describe("toString()", () => {
		test("returns [StorageDiskImpl diskname]", () => {
			const endpoint = memoryStorage({});
			const disk = new StorageDiskImpl("my-disk", endpoint);
			expect(disk.toString()).toBe("[StorageDiskImpl memory://my-disk]");
		});
	});
});
