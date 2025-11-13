import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { StorageDisk } from "../contracts/Storage";
import { expectErrorWithProperties, mockDispatcher, spyOnAll } from "../test-utils";
import { resetAllMocks } from "../testing/mocks";
import { memoryStorage } from "./drivers/memory/MemoryStorageDriver";
import { StorageDiskImpl } from "./StorageDiskImpl";
import { StorageImpl } from "./StorageImpl";
import { DiskNotFoundError } from "./storage-errors";

describe(StorageImpl, () => {
	let storage: StorageImpl;

	beforeEach(() => {
		storage = new StorageImpl(
			{
				disks: { local: memoryStorage({}) },
			},
			mockDispatcher(),
		);
	});

	describe("disk()", () => {
		test("returns default disk when name omitted", () => {
			storage = new StorageImpl(
				{
					disks: { local: memoryStorage({}) },
					defaultDisk: "local",
				},
				mockDispatcher(),
			);
			expect(storage.disk().name).toBe("local");
		});

		test("returns named disk when name provided", () => {
			storage = new StorageImpl(
				{
					disks: {
						first: memoryStorage({}),
						second: memoryStorage({}),
					},
				},
				mockDispatcher(),
			);
			expect(storage.disk("second").name).toBe("second");
		});

		test("throws clear error when disk doesn't exist", () => {
			expectErrorWithProperties(() => storage.disk("nonexistent"), DiskNotFoundError, {
				diskName: "nonexistent",
			});
		});

		test("throws when default disk doesn't exist", () => {
			const storageWithoutDefault = new StorageImpl(
				{
					disks: { other: memoryStorage({}) },
					// No defaultDisk configured, falls back to "local" which doesn't exist
				},
				mockDispatcher(),
			);
			expectErrorWithProperties(() => storageWithoutDefault.disk(), DiskNotFoundError, {
				diskName: "local",
			});
		});

		test("disk() always returns same instance for same name", () => {
			const disk1 = storage.disk("local");
			const disk2 = storage.disk("local");
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
			const disk = storage.build(memoryStorage({}));
			expect(() => storage.disk(disk.name)).toThrow(DiskNotFoundError);
		});

		test("multiple build() calls create independent disks", () => {
			const built1 = storage.build(memoryStorage({}));
			const built2 = storage.build(memoryStorage({}));
			expect(built1).not.toBe(built2);
		});
	});

	describe("mock()", () => {
		test("replaces existing disk", async () => {
			const storage = new StorageImpl(
				{
					disks: {
						test: memoryStorage({
							initialFiles: {
								"/old.txt": "old data",
							},
						}),
					},
				},
				mockDispatcher(),
			);

			// Verify old file exists
			expect(await storage.disk("test").file("old.txt").exists()).toBe(true);

			// Mock the disk
			storage.mock("test");

			// Old file should no longer exist
			expect(await storage.disk("test").file("old.txt").exists()).toBe(false);
		});

		test("accepts custom endpoint", async () => {
			const storage = new StorageImpl(
				{
					disks: { test: memoryStorage({}) },
				},
				mockDispatcher(),
			);

			storage.mock(
				"test",
				memoryStorage({
					initialFiles: {
						"/custom.txt": "custom data",
					},
				}),
			);

			expect(await storage.disk("test").file("custom.txt").exists()).toBe(true);
		});
	});

	describe("resetMocks()", () => {
		test("restores multiple mocked disks", async () => {
			const storage = new StorageImpl(
				{
					disks: {
						disk1: memoryStorage({
							initialFiles: {
								"/file1.txt": "data1",
							},
						}),
						disk2: memoryStorage({
							initialFiles: {
								"/file2.txt": "data2",
							},
						}),
					},
				},
				mockDispatcher(),
			);

			storage.mock("disk1");
			// mock disk2 twice
			storage.mock("disk2");
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
	});

	describe("resetAllMocks() integration", () => {
		test("resets storage mocks when resetAllMocks is called", async () => {
			const storage = new StorageImpl(
				{
					disks: {
						local: memoryStorage({
							initialFiles: {
								"/original.txt": "original data",
							},
						}),
					},
				},
				mockDispatcher(),
			);

			// Mock the disk
			storage.mock("local");

			// Verify original file is gone
			expect(await storage.disk("local").file("original.txt").exists()).toBe(false);

			// Call global reset
			resetAllMocks();

			// Original file should be back
			expect(await storage.disk("local").file("original.txt").exists()).toBe(true);
		});

		test("supports multiple mock and reset cycles", async () => {
			const storage = new StorageImpl(
				{
					disks: {
						local: memoryStorage({
							initialFiles: {
								"/original.txt": "original data",
							},
						}),
					},
				},
				mockDispatcher(),
			);

			// First cycle
			storage.mock("local");
			expect(await storage.disk("local").file("original.txt").exists()).toBe(false);
			resetAllMocks();
			expect(await storage.disk("local").file("original.txt").exists()).toBe(true);

			// Second cycle
			storage.mock("local");
			storage.mock("local");
			expect(await storage.disk("local").file("original.txt").exists()).toBe(false);
			resetAllMocks();
			expect(await storage.disk("local").file("original.txt").exists()).toBe(true);

			// no damage calling it when not required
			resetAllMocks();
			resetAllMocks();
			expect(await storage.disk("local").file("original.txt").exists()).toBe(true);
		});
	});

	describe("directory operations delegation", () => {
		let mockDisk: StorageDisk;
		let storage: StorageImpl;

		beforeEach(() => {
			// Create a mock disk with mocked directory operations
			const endpoint = memoryStorage({});
			mockDisk = spyOnAll(new StorageDiskImpl("mock-disk", endpoint, mockDispatcher()));

			// Create storage and override disk() to return our mock
			storage = new StorageImpl(
				{
					disks: { local: memoryStorage({}) },
					defaultDisk: "local",
				},
				mockDispatcher(),
			);
			storage.disk = mock(() => mockDisk);
		});

		test("storage.exists() delegates to default disk", async () => {
			await storage.exists();
			expect(mockDisk.exists).toHaveBeenCalled();
		});

		test("storage.list() delegates to default disk", async () => {
			await storage.list();
			expect(mockDisk.list).toHaveBeenCalled();
		});

		test("storage.listStreaming() delegates to default disk", () => {
			storage.listStreaming();
			expect(mockDisk.listStreaming).toHaveBeenCalled();
		});

		test("storage.files() delegates to default disk", async () => {
			await storage.files();
			expect(mockDisk.files).toHaveBeenCalled();
		});

		test("storage.files(options) delegates to default disk with options", async () => {
			await storage.files({ recursive: true });
			expect(mockDisk.files).toHaveBeenCalledWith({ recursive: true });
		});

		test("storage.filesStreaming() delegates to default disk", () => {
			storage.filesStreaming();
			expect(mockDisk.filesStreaming).toHaveBeenCalled();
		});

		test("storage.directories() delegates to default disk", async () => {
			await storage.directories();
			expect(mockDisk.directories).toHaveBeenCalled();
		});

		test("storage.directoriesStreaming() delegates to default disk", () => {
			storage.directoriesStreaming();
			expect(mockDisk.directoriesStreaming).toHaveBeenCalled();
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
			expect(storage.toString()).toBe("[StorageImpl]");
		});
	});
});
