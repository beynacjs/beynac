import { describe, test } from "bun:test";
import { StorageFileImpl } from "./StorageFileImpl";

describe(StorageFileImpl, () => {
	describe("constructor", () => {
		test.skip("stores path, disk, endpoint correctly", () => {
			// const disk = { ... };
			// const endpoint = { ... };
			// const file = new StorageFileImpl(disk, endpoint, "path/to/file.txt");
			// expect(file.path).toBe("path/to/file.txt");
			// expect(file.disk).toBe(disk);
		});

		test.skip("normalizes path - removes trailing slash", () => {
			// const disk = { ... };
			// const endpoint = { ... };
			// const file = new StorageFileImpl(disk, endpoint, "path/to/file.txt/");
			// expect(file.path).toBe("path/to/file.txt");
		});
	});

	describe("type property", () => {
		test.skip("always returns file", () => {
			// const disk = { ... };
			// const endpoint = { ... };
			// const file = new StorageFileImpl(disk, endpoint, "test.txt");
			// expect(file.type).toBe("file");
		});
	});

	describe("path handling", () => {
		test.skip("handles paths with leading slash", () => {
			// const disk = { ... };
			// const endpoint = { ... };
			// const file = new StorageFileImpl(disk, endpoint, "/path/to/file.txt");
			// // Verify path is normalized correctly
		});

		test.skip("handles empty path", () => {
			// const disk = { ... };
			// const endpoint = { ... };
			// const file = new StorageFileImpl(disk, endpoint, "");
			// expect(file.path).toBe("");
		});
	});
});
