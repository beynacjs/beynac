import { describe, test } from "bun:test";
import { StorageDirectoryImpl } from "./StorageDirectoryImpl";

describe(StorageDirectoryImpl, () => {
	describe("constructor", () => {
		test.skip("stores path, disk, endpoint correctly", () => {
			// const disk = { ... };
			// const endpoint = { ... };
			// const dir = new StorageDirectoryImpl(disk, endpoint, "path/to/dir");
			// expect(dir.path).toBe("path/to/dir/");
			// expect(dir.disk).toBe(disk);
		});

		test.skip("normalizes path - adds trailing slash", () => {
			// const disk = { ... };
			// const endpoint = { ... };
			// const dir = new StorageDirectoryImpl(disk, endpoint, "path/to/dir");
			// expect(dir.path).toBe("path/to/dir/");
		});

		test.skip("preserves existing trailing slash", () => {
			// const disk = { ... };
			// const endpoint = { ... };
			// const dir = new StorageDirectoryImpl(disk, endpoint, "path/to/dir/");
			// expect(dir.path).toBe("path/to/dir/");
		});
	});

	describe("type property", () => {
		test.skip("always returns directory", () => {
			// const disk = { ... };
			// const endpoint = { ... };
			// const dir = new StorageDirectoryImpl(disk, endpoint, "test");
			// expect(dir.type).toBe("directory");
		});
	});

	describe("path handling", () => {
		test.skip("handles paths with leading slash", () => {
			// const disk = { ... };
			// const endpoint = { ... };
			// const dir = new StorageDirectoryImpl(disk, endpoint, "/path/to/dir");
			// // Verify path is normalized correctly
		});
	});
});
