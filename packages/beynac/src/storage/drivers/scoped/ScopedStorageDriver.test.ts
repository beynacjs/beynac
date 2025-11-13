import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { StorageEndpoint } from "../../../contracts/Storage";
import { mockDispatcher } from "../../../test-utils";
import { StorageImpl } from "../../StorageImpl";
import { driverSharedTests } from "../driver-shared.test";
import { memoryStorage } from "../memory/MemoryStorageDriver";
import { scopedStorage } from "./ScopedStorageDriver";

driverSharedTests(function rootScopedStorage() {
	return scopedStorage({
		disk: memoryStorage(),
		prefix: "/",
	});
});

driverSharedTests(function nestedScopedStorage() {
	return scopedStorage({
		disk: memoryStorage(),
		prefix: "/scoped/",
	});
});

describe(scopedStorage, () => {
	let wrappedDisk: StorageEndpoint;
	let scopedDisk: StorageEndpoint;

	beforeEach(() => {
		wrappedDisk = memoryStorage();
		scopedDisk = scopedStorage({
			disk: wrappedDisk,
			prefix: "/videos/",
		});
	});

	test("writeSingle() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "writeSingle");

		await scopedDisk.writeSingle({
			path: "/tutorial.mp4",
			data: "video-content",
			mimeType: "video/mp4",
		});

		expect(spy).toHaveBeenCalledWith({
			path: "/videos/tutorial.mp4",
			data: "video-content",
			mimeType: "video/mp4",
		});
	});

	test("readSingle() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "readSingle");

		await wrappedDisk.writeSingle({
			path: "/videos/file.txt",
			data: "content",
			mimeType: "text/plain",
		});

		await scopedDisk.readSingle("/file.txt");

		expect(spy).toHaveBeenCalledWith("/videos/file.txt");
	});

	test("getInfoSingle() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "getInfoSingle");

		await wrappedDisk.writeSingle({
			path: "/videos/file.txt",
			data: "content",
			mimeType: "text/plain",
		});

		await scopedDisk.getInfoSingle("/file.txt");

		expect(spy).toHaveBeenCalledWith("/videos/file.txt");
	});

	test("existsSingle() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "existsSingle");

		await scopedDisk.existsSingle("/file.txt");

		expect(spy).toHaveBeenCalledWith("/videos/file.txt");
	});

	test("existsAnyUnderPrefix() prepends prefix to prefix parameter", async () => {
		const spy = spyOn(wrappedDisk, "existsAnyUnderPrefix");

		await scopedDisk.existsAnyUnderPrefix("/subfolder/");

		expect(spy).toHaveBeenCalledWith("/videos/subfolder/");
	});

	test("copy() prepends prefix to both source and destination", async () => {
		const spy = spyOn(wrappedDisk, "copy");

		await wrappedDisk.writeSingle({
			path: "/videos/source.txt",
			data: "content",
			mimeType: "text/plain",
		});

		await scopedDisk.copy("/source.txt", "/dest.txt");

		expect(spy).toHaveBeenCalledWith("/videos/source.txt", "/videos/dest.txt");
	});

	test("move() prepends prefix to both source and destination", async () => {
		const spy = spyOn(wrappedDisk, "move");

		await wrappedDisk.writeSingle({
			path: "/videos/source.txt",
			data: "content",
			mimeType: "text/plain",
		});

		await scopedDisk.move("/source.txt", "/dest.txt");

		expect(spy).toHaveBeenCalledWith("/videos/source.txt", "/videos/dest.txt");
	});

	test("deleteSingle() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "deleteSingle");

		await scopedDisk.deleteSingle("/file.txt");

		expect(spy).toHaveBeenCalledWith("/videos/file.txt");
	});

	test("deleteAllUnderPrefix() prepends prefix to prefix parameter", async () => {
		const spy = spyOn(wrappedDisk, "deleteAllUnderPrefix");

		await scopedDisk.deleteAllUnderPrefix("/subfolder/");

		expect(spy).toHaveBeenCalledWith("/videos/subfolder/");
	});

	test("listEntries() prepends prefix to prefix parameter", async () => {
		const spy = spyOn(wrappedDisk, "listEntries");

		await Array.fromAsync(scopedDisk.listEntries("/subfolder/"));

		expect(spy).toHaveBeenCalledWith("/videos/subfolder/");
	});

	test("listFilesRecursive() prepends prefix to prefix parameter", async () => {
		const spy = spyOn(wrappedDisk, "listFilesRecursive");

		await Array.fromAsync(scopedDisk.listFilesRecursive("/subfolder/"));

		expect(spy).toHaveBeenCalledWith("/videos/subfolder/");
	});

	test("getPublicDownloadUrl() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "getPublicDownloadUrl");

		await scopedDisk.getPublicDownloadUrl("/file.txt", "download.txt");

		expect(spy).toHaveBeenCalledWith("/videos/file.txt", "download.txt");
	});

	test("getSignedDownloadUrl() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "getSignedDownloadUrl");
		const expires = new Date();

		await scopedDisk.getSignedDownloadUrl("/file.txt", expires, "download.txt");

		expect(spy).toHaveBeenCalledWith("/videos/file.txt", expires, "download.txt");
	});

	test("getTemporaryUploadUrl() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "getTemporaryUploadUrl");
		const expires = new Date();

		await scopedDisk.getTemporaryUploadUrl("/file.txt", expires);

		expect(spy).toHaveBeenCalledWith("/videos/file.txt", expires);
	});

	test("operations are isolated to the scoped prefix", async () => {
		// Write files outside the scope
		await wrappedDisk.writeSingle({
			path: "/other/file.txt",
			data: "outside",
			mimeType: "text/plain",
		});

		// Write files inside the scope
		await scopedDisk.writeSingle({
			path: "/inside.txt",
			data: "inside",
			mimeType: "text/plain",
		});

		// Scoped disk should only see files in its prefix
		expect(await scopedDisk.existsSingle("/inside.txt")).toBe(true);
		expect(await scopedDisk.existsSingle("/other/file.txt")).toBe(false);

		// Wrapped disk should see both
		expect(await wrappedDisk.existsSingle("/videos/inside.txt")).toBe(true);
		expect(await wrappedDisk.existsSingle("/other/file.txt")).toBe(true);
	});

	test("path normalization works with scoped storage", async () => {
		const storage = new StorageImpl(
			{
				disks: { scoped: scopedDisk },
				defaultDisk: "scoped",
			},
			mockDispatcher(),
		);

		const disk = storage.disk();

		// Set up a file outside the scoped area in the wrapped disk
		await wrappedDisk.writeSingle({
			path: "/secret.txt",
			data: "secret-content",
			mimeType: "text/plain",
		});

		// Path normalization stops at / (the root of the scoped disk, which is /videos/)
		// So /../secret.txt normalizes to /secret.txt within the scope
		// This accesses /videos/secret.txt on the wrapped disk, not /secret.txt
		expect(await disk.file("/../../secret.txt").exists()).toBe(false);
		expect(await disk.file("../../secret.txt").exists()).toBe(false);
		expect(await disk.directory("/").file("secret.txt").exists()).toBe(false);
		expect(await disk.directory("../../..").file("secret.txt").exists()).toBe(false);
	});

	test("forwards supportsMimeTypes from wrapped disk", () => {
		const diskWithMime = memoryStorage({ supportsMimeTypes: true });
		const diskWithoutMime = memoryStorage({ supportsMimeTypes: false });

		const scopedWithMime = scopedStorage({ disk: diskWithMime, prefix: "/test/" });
		const scopedWithoutMime = scopedStorage({ disk: diskWithoutMime, prefix: "/test/" });

		expect(scopedWithMime.supportsMimeTypes).toBe(true);
		expect(scopedWithoutMime.supportsMimeTypes).toBe(false);
	});

	test("forwards invalidNameChars from wrapped disk", () => {
		const diskWithInvalid = memoryStorage({ invalidNameChars: '<>:"' });
		const diskWithoutInvalid = memoryStorage({ invalidNameChars: "" });

		const scopedWithInvalid = scopedStorage({ disk: diskWithInvalid, prefix: "/test/" });
		const scopedWithoutInvalid = scopedStorage({ disk: diskWithoutInvalid, prefix: "/test/" });

		expect(scopedWithInvalid.invalidNameChars).toBe('<>:"');
		expect(scopedWithoutInvalid.invalidNameChars).toBe("");
	});

	test.each([
		["videos", "/file.txt", "/videos/file.txt"],
		["/videos", "/file.txt", "/videos/file.txt"],
		["videos/", "/file.txt", "/videos/file.txt"],
		["/videos/", "/file.txt", "/videos/file.txt"],
		["/", "/file.txt", "/file.txt"],
		["", "/file.txt", "/file.txt"],
		["/users/123/uploads/", "/file.txt", "/users/123/uploads/file.txt"],
	])('handles "%s" prefix and "%s" path', async (prefix, path, expected) => {
		const wrappedDisk = memoryStorage();
		const spy = spyOn(wrappedDisk, "writeSingle");

		const scopedDisk = scopedStorage({
			disk: wrappedDisk,
			prefix,
		});

		await scopedDisk.writeSingle({
			path,
			data: "content",
			mimeType: "text/plain",
		});

		expect(spy).toHaveBeenCalledWith({
			path: expected,
			data: "content",
			mimeType: "text/plain",
		});
	});
});
