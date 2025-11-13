import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import * as os from "node:os";
import { join } from "node:path";
import type { StorageEndpoint } from "../../../contracts";
import { StorageUnknownError } from "../../storage-errors";
import type { SharedTestConfig } from "../driver-shared.test";
import { filesystemStorage } from "./FilesystemStorageDriver";

function filesystemStorageWithTmpDir(): StorageEndpoint {
	const tempDir = mkdtempSync(join(os.tmpdir(), "beynac-fs-test-"));
	return filesystemStorage({
		rootPath: tempDir,
		publicUrlPrefix: "https://example.com/files",
		getSignedDownloadUrl: ({ path, expires, downloadFileName }) => {
			const params = new URLSearchParams();
			params.set("expires", expires.toISOString());
			if (downloadFileName) {
				params.set("download", downloadFileName);
			}
			return `mock-url://download${path}?${params.toString()}`;
		},
		getSignedUploadUrl: ({ path, expires }) => {
			const params = new URLSearchParams();
			params.set("expires", expires.toISOString());
			return `mock-url://upload${path}?${params.toString()}`;
		},
	});
}

export const filesystemStorageSharedTestConfig: SharedTestConfig = {
	name: filesystemStorage.name,
	createEndpoint: filesystemStorageWithTmpDir,
};

describe(filesystemStorage, () => {
	describe("Filesystem-specific behavior", () => {
		test("publicUrlPrefix configuration - throws when not configured", async () => {
			const tempDir = mkdtempSync(join(os.tmpdir(), "beynac-fs-test-"));
			const storage = filesystemStorage({ rootPath: tempDir }); // No publicUrlPrefix

			await storage.writeSingle({ path: "/test.txt", data: "content", mimeType: "text/plain" });

			expect(storage.getPublicDownloadUrl("/test.txt")).rejects.toThrow(
				"publicUrlPrefix is required",
			);
			expect(
				storage.getSignedDownloadUrl("/test.txt", new Date(Date.now() + 3600000)),
			).rejects.toThrow("getSignedDownloadUrl is required");
			expect(
				storage.getTemporaryUploadUrl("/test.txt", new Date(Date.now() + 3600000)),
			).rejects.toThrow("getSignedUploadUrl is required");
		});

		test("publicUrlPrefix configuration - uses configured prefix", async () => {
			const tempDir = mkdtempSync(join(os.tmpdir(), "beynac-fs-test-"));
			const storage = filesystemStorage({
				rootPath: tempDir,
				publicUrlPrefix: "https://cdn.example.com/files",
				getSignedDownloadUrl: ({ path, expires, downloadFileName }) => {
					const params = new URLSearchParams();
					params.set("expires", expires.toISOString());
					if (downloadFileName) {
						params.set("download", downloadFileName);
					}
					return `https://cdn.example.com/files${path}?${params.toString()}`;
				},
				getSignedUploadUrl: ({ path, expires }) => {
					const params = new URLSearchParams();
					params.set("upload", "true");
					params.set("expires", expires.toISOString());
					return `https://cdn.example.com/files${path}?${params.toString()}`;
				},
			});

			await storage.writeSingle({ path: "/test.txt", data: "content", mimeType: "text/plain" });

			const publicUrl = await storage.getPublicDownloadUrl("/test.txt");
			expect(publicUrl).toBe("https://cdn.example.com/files/test.txt");

			const publicUrlWithDownload = await storage.getPublicDownloadUrl("/test.txt", "custom.txt");
			expect(publicUrlWithDownload).toBe(
				"https://cdn.example.com/files/test.txt?download=custom.txt",
			);

			const signedUrl = await storage.getSignedDownloadUrl(
				"/test.txt",
				new Date(Date.now() + 3600000),
			);
			expect(signedUrl).toMatch(/^https:\/\/cdn\.example\.com\/files\/test\.txt\?expires=/);

			const uploadUrl = await storage.getTemporaryUploadUrl(
				"/test.txt",
				new Date(Date.now() + 3600000),
			);
			expect(uploadUrl).toMatch(
				/^https:\/\/cdn\.example\.com\/files\/test\.txt\?upload=true&expires=/,
			);
		});

		test("publicUrlPrefix with trailing slash", async () => {
			const tempDir = mkdtempSync(join(os.tmpdir(), "beynac-fs-test-"));
			const storage = filesystemStorage({
				rootPath: tempDir,
				publicUrlPrefix: "https://cdn.example.com/files/",
			});

			await storage.writeSingle({ path: "/test.txt", data: "content", mimeType: "text/plain" });

			const url = await storage.getPublicDownloadUrl("/test.txt");
			expect(url).toBe("https://cdn.example.com/files/test.txt");
		});

		test("ETag changes when file is modified", async () => {
			const storage = filesystemStorageWithTmpDir();

			await storage.writeSingle({ path: "/test.txt", data: "content1", mimeType: "text/plain" });
			const info1 = await storage.getInfoSingle("/test.txt");

			// Wait a bit to ensure mtime changes
			await new Promise((resolve) => setTimeout(resolve, 10));

			await storage.writeSingle({ path: "/test.txt", data: "content2", mimeType: "text/plain" });
			const info2 = await storage.getInfoSingle("/test.txt");

			expect(info1?.etag).not.toBe(info2?.etag);
		});

		test("ETag format is consistent", async () => {
			const storage = filesystemStorageWithTmpDir();

			await storage.writeSingle({ path: "/test.txt", data: "content", mimeType: "text/plain" });
			const info = await storage.getInfoSingle("/test.txt");

			expect(info?.etag).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
		});

		test("deeply nested directories are auto-created", async () => {
			const tempDir = mkdtempSync(join(os.tmpdir(), "beynac-fs-test-"));
			const storage = filesystemStorage({ rootPath: tempDir });

			await storage.writeSingle({
				path: "/a/b/c/d/e/file.txt",
				data: "content",
				mimeType: "text/plain",
			});

			const exists = await storage.existsSingle("/a/b/c/d/e/file.txt");
			expect(exists).toBe(true);

			// Verify actual filesystem structure
			const filePath = join(tempDir, "a/b/c/d/e/file.txt");
			const content = readFileSync(filePath, "utf-8");
			expect(content).toBe("content");
		});

		test("copy creates destination directories", async () => {
			const storage = filesystemStorageWithTmpDir();

			await storage.writeSingle({ path: "/source.txt", data: "content", mimeType: "text/plain" });
			await storage.copy("/source.txt", "/deep/nested/dest.txt");

			const exists = await storage.existsSingle("/deep/nested/dest.txt");
			expect(exists).toBe(true);
		});

		test("move creates destination directories", async () => {
			const storage = filesystemStorageWithTmpDir();

			await storage.writeSingle({ path: "/source.txt", data: "content", mimeType: "text/plain" });
			await storage.move("/source.txt", "/deep/nested/dest.txt");

			const sourceExists = await storage.existsSingle("/source.txt");
			const destExists = await storage.existsSingle("/deep/nested/dest.txt");
			expect(sourceExists).toBe(false);
			expect(destExists).toBe(true);
		});

		test("no metadata files are created", async () => {
			const tempDir = mkdtempSync(join(os.tmpdir(), "beynac-fs-test-"));
			const storage = filesystemStorage({ rootPath: tempDir });

			await storage.writeSingle({
				path: "/test.txt",
				data: "content",
				mimeType: "text/plain",
			});

			const files = readdirSync(tempDir);
			expect(files).toEqual(["test.txt"]);
			expect(files.some((f) => f.includes("meta"))).toBe(false);
		});

		test("files written with different MIME types don't store metadata", async () => {
			const tempDir = mkdtempSync(join(os.tmpdir(), "beynac-fs-test-"));
			const storage = filesystemStorage({ rootPath: tempDir });

			await storage.writeSingle({
				path: "/file1.txt",
				data: "content1",
				mimeType: "text/plain",
			});
			await storage.writeSingle({
				path: "/file2.txt",
				data: "content2",
				mimeType: "text/html",
			});

			const files = readdirSync(tempDir);
			expect(files.sort()).toEqual(["file1.txt", "file2.txt"]);

			// Both files should return null for MIME type
			const info1 = await storage.getInfoSingle("/file1.txt");
			const info2 = await storage.getInfoSingle("/file2.txt");
			expect(info1?.mimeType).toBe(null);
			expect(info2?.mimeType).toBe(null);
		});

		test("reading a directory as a file produces EISDIR error from stream", async () => {
			const tempDir = mkdtempSync(join(os.tmpdir(), "beynac-fs-test-"));
			const storage = filesystemStorage({ rootPath: tempDir });

			// Create a directory
			await storage.writeSingle({
				path: "/subdir/file.txt",
				data: "content",
				mimeType: "text/plain",
			});

			let error: Error | null = null;
			try {
				const result = await storage.readSingle("/subdir");
				await new Response(result.data).arrayBuffer();
			} catch (e) {
				error = e as Error;
			}

			// Errors should be converted to non-node error
			expect(error).toBeInstanceOf(StorageUnknownError);
			expect(error?.toString()).toContain("EISDIR: illegal operation on a directory, read");
		});
	});
});
