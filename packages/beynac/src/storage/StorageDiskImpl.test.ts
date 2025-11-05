import { describe, test } from "bun:test";
import { StorageDiskImpl } from "./StorageDiskImpl";

describe(StorageDiskImpl, () => {
	describe("constructor", () => {
		test.skip("stores name and endpoint correctly", () => {
			// const endpoint = { ... };
			// const disk = new StorageDiskImpl("test-disk", endpoint);
			// expect(disk.name).toBe("test-disk");
		});
	});

	describe("file()", () => {
		test.skip("creates StorageFileImpl with correct params", () => {
			// const endpoint = { ... };
			// const disk = new StorageDiskImpl("test-disk", endpoint);
			// const file = disk.file("path/to/file.txt");
			// expect(file.path).toBe("path/to/file.txt");
			// expect(file.disk).toBe(disk);
		});

		test.skip("normalizes file path - removes trailing slash", () => {
			// const endpoint = { ... };
			// const disk = new StorageDiskImpl("test-disk", endpoint);
			// const file = disk.file("path/to/file.txt/");
			// expect(file.path).toBe("path/to/file.txt");
		});
	});

	describe("directory()", () => {
		test.skip("creates StorageDirectoryImpl with correct params", () => {
			// const endpoint = { ... };
			// const disk = new StorageDiskImpl("test-disk", endpoint);
			// const dir = disk.directory("path/to/dir");
			// expect(dir.path).toBe("path/to/dir/");
			// expect(dir.disk).toBe(disk);
		});

		test.skip("normalizes directory path - adds trailing slash", () => {
			// const endpoint = { ... };
			// const disk = new StorageDiskImpl("test-disk", endpoint);
			// const dir = disk.directory("path/to/dir");
			// expect(dir.path).toBe("path/to/dir/");
		});
	});

	describe("root path handling", () => {
		test.skip("files() operates on root", () => {
			// const endpoint = { ... };
			// const disk = new StorageDiskImpl("test-disk", endpoint);
			// // Test that files() works on root (empty string or "/")
		});
	});
});
