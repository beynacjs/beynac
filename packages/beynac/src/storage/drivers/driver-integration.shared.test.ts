import { beforeEach, describe, expect, test } from "bun:test";
import type { StorageDisk, StorageEndpoint } from "../../contracts/Storage";
import { StorageImpl } from "../StorageImpl";

export const defineDriverIntegrationTests = (driver: () => StorageEndpoint): void => {
	let endpoint: StorageEndpoint;
	let disk: StorageDisk;

	beforeEach(() => {
		endpoint = driver();
		disk = new StorageImpl({ disks: { test: endpoint } }).disk("test");
	});

	describe(`${driver.name} Minimal Integration Tests`, () => {
		test("smoke test: create, read, and delete file through full stack", async () => {
			const file = disk.file("test.txt");
			await file.put({ data: "hello world", mimeType: "text/plain" });

			expect(await file.exists()).toBe(true);

			const response = await file.fetch();
			expect(await response.text()).toBe("hello world");

			await file.delete();
			expect(await file.exists()).toBe(false);
		});

		test("cross-disk isolation: operations on one disk don't affect another", async () => {
			const storage = new StorageImpl({
				disks: {
					disk1: driver(),
					disk2: driver(),
				},
			});
			const file1 = storage.disk("disk1").file("test.txt");
			const file2 = storage.disk("disk2").file("test.txt");

			await file1.put({ data: "disk1 data", mimeType: "text/plain" });

			expect(await file1.exists()).toBe(true);
			expect(await file2.exists()).toBe(false);
		});

		test("cross-disk copy: copyTo() works between different disks", async () => {
			const storage = new StorageImpl({
				disks: {
					disk1: driver(),
					disk2: driver(),
				},
			});
			const source = storage.disk("disk1").file("source.txt");
			await source.put({ data: "hello", mimeType: "text/plain" });

			const dest = storage.disk("disk2").file("dest.txt");
			await source.copyTo(dest);

			expect(await dest.exists()).toBe(true);
			const response = await dest.fetch();
			expect(await response.text()).toBe("hello");
		});

		test("deep directory nesting: chained directory() calls maintain correct paths", async () => {
			const dir = disk.directory("a").directory("b").directory("c");
			const file = dir.file("test.txt");
			await file.put({ data: "deep", mimeType: "text/plain" });

			expect(await file.exists()).toBe(true);
			expect(file.path).toContain("a/b/c/test.txt");
		});

		test("no double slashes: various path combinations don't create //", async () => {
			const dir = disk.directory("a/b/");
			const file = dir.file("/c/d.txt");
			await file.put({ data: "test", mimeType: "text/plain" });

			expect(file.path).not.toContain("//");

			const files = await disk.allFiles();
			for (const f of files) {
				expect(f.path).not.toContain("//");
			}
		});

		test("MIME type propagation: MIME type flows through put → info → fetch", async () => {
			const file = disk.file("test.json");
			await file.put({ data: "{}", mimeType: "application/json" });

			const info = await file.info();
			expect(info?.mimeType).toBe("application/json");

			const response = await file.fetch();
			expect(response.headers.get("Content-Type")).toBe("application/json");
		});
	});
};
