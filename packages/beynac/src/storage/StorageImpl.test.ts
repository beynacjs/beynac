import { describe, test } from "bun:test";
import { StorageImpl } from "./StorageImpl";

describe(StorageImpl, () => {
	describe("constructor", () => {
		test.skip("throws when no disks configured", () => {
			// expect(() => new StorageImpl({ disks: {} })).toThrow("At least one disk");
		});

		test.skip("uses first disk as default when defaultDisk not specified", () => {
			// const storage = new StorageImpl({
			//   disks: {
			//     first: disk(new MemoryDriver(), {}),
			//     second: disk(new MemoryDriver(), {}),
			//   }
			// });
			// expect(storage.disk().name).toBe("first");
		});

		test.skip("throws when defaultDisk doesn't exist", () => {
			// expect(() => new StorageImpl({
			//   disks: { test: disk(new MemoryDriver(), {}) },
			//   defaultDisk: "nonexistent"
			// })).toThrow("Default disk");
		});
	});

	describe("disk()", () => {
		test.skip("returns default disk when name omitted", () => {
			// const storage = new StorageImpl({
			//   disks: { test: disk(new MemoryDriver(), {}) }
			// });
			// expect(storage.disk().name).toBe("test");
		});

		test.skip("returns named disk when name provided", () => {
			// const storage = new StorageImpl({
			//   disks: {
			//     first: disk(new MemoryDriver(), {}),
			//     second: disk(new MemoryDriver(), {}),
			//   }
			// });
			// expect(storage.disk("second").name).toBe("second");
		});

		test.skip("throws clear error when disk doesn't exist", () => {
			// const storage = new StorageImpl({
			//   disks: { test: disk(new MemoryDriver(), {}) }
			// });
			// expect(() => storage.disk("nonexistent")).toThrow();
		});

		test.skip("disk() always returns same instance for same name", () => {
			// const storage = new StorageImpl({
			//   disks: { test: disk(new MemoryDriver(), {}) }
			// });
			// const disk1 = storage.disk("test");
			// const disk2 = storage.disk("test");
			// expect(disk1).toBe(disk2);
		});
	});

	describe("build()", () => {
		test.skip("creates disk from driver and config", () => {
			// const storage = new StorageImpl({
			//   disks: { test: disk(new MemoryDriver(), {}) }
			// });
			// const built = storage.build(new MemoryDriver(), {});
			// expect(built).toBeDefined();
		});

		test.skip("built disk works correctly", () => {
			// const storage = new StorageImpl({
			//   disks: { test: disk(new MemoryDriver(), {}) }
			// });
			// const built = storage.build(new MemoryDriver(), {});
			// const file = built.file("test.txt");
			// expect(file.path).toBe("test.txt");
		});

		test.skip("built disk not registered by name", () => {
			// const storage = new StorageImpl({
			//   disks: { test: disk(new MemoryDriver(), {}) }
			// });
			// storage.build(new MemoryDriver(), {});
			// expect(() => storage.disk("built")).toThrow();
		});

		test.skip("multiple build() calls create independent disks", () => {
			// const storage = new StorageImpl({
			//   disks: { test: disk(new MemoryDriver(), {}) }
			// });
			// const built1 = storage.build(new MemoryDriver(), {});
			// const built2 = storage.build(new MemoryDriver(), {});
			// expect(built1).not.toBe(built2);
		});
	});

	describe("mock()", () => {
		test.skip("replaces existing disk", () => {
			// const storage = new StorageImpl({
			//   disks: { test: disk(new MemoryDriver(), {}) }
			// });
			// storage.mock("test");
			// // Verify disk is replaced with temp directory
		});

		test.skip("can mock default disk", () => {
			// const storage = new StorageImpl({
			//   disks: { test: disk(new MemoryDriver(), {}) }
			// });
			// storage.mock("test");
			// const defaultDisk = storage.disk();
			// // Verify it's a mocked disk
		});
	});

	describe("directory operations delegation", () => {
		test.skip("storage.allFiles() delegates to default disk", () => {
			// const storage = new StorageImpl({
			//   disks: { test: disk(new MemoryDriver(), {}) }
			// });
			// // Test that it delegates
		});

		test.skip("storage.directory() delegates to default disk", () => {
			// const storage = new StorageImpl({
			//   disks: { test: disk(new MemoryDriver(), {}) }
			// });
			// const dir = storage.directory("subdir");
			// expect(dir.path).toBe("subdir/");
		});
	});
});
