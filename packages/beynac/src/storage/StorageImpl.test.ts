import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { StorageDisk } from "../contracts/Storage";
import { memoryStorage } from "./drivers/memory/MemoryStorageDriver";
import { StorageDiskImpl } from "./StorageDiskImpl";
import { StorageImpl } from "./StorageImpl";
import { mockStorageDirectory } from "./test-helpers";

describe(StorageImpl, () => {
	let storage: StorageImpl;

	beforeEach(() => {
		storage = new StorageImpl({
			disks: { local: memoryStorage({}) },
		});
	});

	describe("disk()", () => {
		test("returns default disk when name omitted", () => {
			storage = new StorageImpl({
				disks: { local: memoryStorage({}) },
				defaultDisk: "local",
			});
			expect(storage.disk().name).toBe("local");
		});

		test("returns named disk when name provided", () => {
			storage = new StorageImpl({
				disks: {
					first: memoryStorage({}),
					second: memoryStorage({}),
				},
			});
			expect(storage.disk("second").name).toBe("second");
		});

		test("throws clear error when disk doesn't exist", () => {
			expect(() => storage.disk("nonexistent")).toThrow('Disk "nonexistent" not found');
		});

		test("disk() always returns same instance for same name", () => {
			storage = new StorageImpl({
				disks: { test: memoryStorage({}) },
			});
			const disk1 = storage.disk("test");
			const disk2 = storage.disk("test");
			expect(disk1).toBe(disk2);
		});
	});

	describe("build()", () => {
		test("creates disk from endpoint", () => {
			const built = storage.build(memoryStorage({}));
			expect(built).toBeInstanceOf(StorageDiskImpl);
			expect(built.name).toStartWith("anon");
		});

		test("built disk not registered by name", () => {
			const storage = new StorageImpl({
				disks: { test: memoryStorage({}) },
			});
			const disk = storage.build(memoryStorage({}));
			expect(() => storage.disk(disk.name)).toThrow(/Disk "anon\w+" not found/);
		});

		test("multiple build() calls create independent disks", () => {
			const storage = new StorageImpl({
				disks: { test: memoryStorage({}) },
			});
			const built1 = storage.build(memoryStorage({}));
			const built2 = storage.build(memoryStorage({}));
			expect(built1).not.toBe(built2);
		});
	});

	describe("mock()", () => {
		test("replaces existing disk", async () => {
			const storage = new StorageImpl({
				disks: {
					test: memoryStorage({
						initialFiles: {
							"/old.txt": { data: "old data", mimeType: "text/plain" },
						},
					}),
				},
			});

			// Verify old file exists
			expect(await storage.disk("test").file("old.txt").exists()).toBe(true);

			// Mock the disk
			storage.mock("test");

			// Old file should no longer exist
			expect(await storage.disk("test").file("old.txt").exists()).toBe(false);
		});

		test("can mock default disk", async () => {
			const storage = new StorageImpl({
				disks: { local: memoryStorage({}) },
				defaultDisk: "local",
			});
			storage.mock("local");
			const defaultDisk = storage.disk();

			// Verify it's a fresh disk by writing and reading
			await defaultDisk.file("test.txt").put({ data: "hello", mimeType: "text/plain" });
			expect(await defaultDisk.file("test.txt").exists()).toBe(true);
		});
	});

	describe("resetMocks()", () => {
		test("restores original disk endpoint", async () => {
			const storage = new StorageImpl({
				disks: {
					test: memoryStorage({
						initialFiles: {
							"/original.txt": { data: "original data", mimeType: "text/plain" },
						},
					}),
				},
			});

			// Verify original file exists
			expect(await storage.disk("test").file("original.txt").exists()).toBe(true);

			// Mock the disk and add a new file
			storage.mock("test");
			expect(await storage.disk("test").file("original.txt").exists()).toBe(false);
			await storage
				.disk("test")
				.file("mocked.txt")
				.put({ data: "mock data", mimeType: "text/plain" });
			expect(await storage.disk("test").file("mocked.txt").exists()).toBe(true);

			// Reset mocks
			storage.resetMocks();

			// Original file should be back, mocked file should be gone
			expect(await storage.disk("test").file("original.txt").exists()).toBe(true);
			expect(await storage.disk("test").file("mocked.txt").exists()).toBe(false);
		});

		test("restores multiple mocked disks", async () => {
			const storage = new StorageImpl({
				disks: {
					disk1: memoryStorage({
						initialFiles: {
							"/file1.txt": { data: "data1", mimeType: "text/plain" },
						},
					}),
					disk2: memoryStorage({
						initialFiles: {
							"/file2.txt": { data: "data2", mimeType: "text/plain" },
						},
					}),
				},
			});

			// Mock both disks
			storage.mock("disk1");
			storage.mock("disk2");

			// Verify original files are gone
			expect(await storage.disk("disk1").file("file1.txt").exists()).toBe(false);
			expect(await storage.disk("disk2").file("file2.txt").exists()).toBe(false);

			// Reset all mocks
			storage.resetMocks();

			// Both original files should be back
			expect(await storage.disk("disk1").file("file1.txt").exists()).toBe(true);
			expect(await storage.disk("disk2").file("file2.txt").exists()).toBe(true);
		});

		test("does nothing if no disks were mocked", async () => {
			const storage = new StorageImpl({
				disks: {
					test: memoryStorage({
						initialFiles: {
							"/file.txt": { data: "data", mimeType: "text/plain" },
						},
					}),
				},
			});

			// Reset without mocking anything
			storage.resetMocks();

			// Original file should still exist
			expect(await storage.disk("test").file("file.txt").exists()).toBe(true);
		});
	});

	describe("directory operations delegation", () => {
		let mockDisk: StorageDisk;
		let storage: StorageImpl;

		beforeEach(() => {
			// Create a mock disk with mocked directory operations
			const mockDir = mockStorageDirectory();
			mockDisk = {
				name: "mock-disk",
				...mockDir,
			};

			// Create storage and override disk() to return our mock
			storage = new StorageImpl({
				disks: { local: memoryStorage({}) },
				defaultDisk: "local",
			});
			storage.disk = mock(() => mockDisk);
		});

		test("storage.exists() delegates to default disk", async () => {
			await storage.exists();
			expect(mockDisk.exists).toHaveBeenCalled();
		});

		test("storage.files() delegates to default disk", async () => {
			await storage.files();
			expect(mockDisk.files).toHaveBeenCalled();
		});

		test("storage.allFiles() delegates to default disk", async () => {
			await storage.allFiles();
			expect(mockDisk.allFiles).toHaveBeenCalled();
		});

		test("storage.directories() delegates to default disk", async () => {
			await storage.directories();
			expect(mockDisk.directories).toHaveBeenCalled();
		});

		test("storage.allDirectories() delegates to default disk", async () => {
			await storage.allDirectories();
			expect(mockDisk.allDirectories).toHaveBeenCalled();
		});

		test("storage.deleteAll() delegates to default disk", async () => {
			await storage.deleteAll();
			expect(mockDisk.deleteAll).toHaveBeenCalled();
		});

		test("storage.directory(path) delegates to default disk with path", () => {
			storage.directory("subdir");
			expect(mockDisk.directory).toHaveBeenCalledWith("subdir");
		});

		test("storage.file(path) delegates to default disk with path", () => {
			storage.file("test.txt");
			expect(mockDisk.file).toHaveBeenCalledWith("test.txt");
		});
	});

	describe("toString()", () => {
		test("returns [StorageImpl]", () => {
			const storage = new StorageImpl({
				disks: { local: memoryStorage({}) },
			});
			expect(storage.toString()).toBe("[StorageImpl]");
		});
	});
});
