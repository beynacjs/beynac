import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import * as nodefs from "node:fs";
import * as fs from "node:fs/promises";
import { Readable, Writable } from "node:stream";
import { mockDispatcher } from "../../../test-utils";
import { resetAllMocks } from "../../../testing";
import { mockPlatformPaths } from "../../path";
import { StorageImpl } from "../../StorageImpl";
import { filesystemStorage } from "./FilesystemStorageDriver";

afterEach(() => {
	resetAllMocks();
});

describe("FilesystemStorageDriver - Windows path handling", () => {
	let statMock: ReturnType<typeof mock>;

	beforeEach(async () => {
		// Mock fs.stat to capture the path and return fake stats
		statMock = mock(() => {
			return Promise.resolve({
				size: 1234,
				mtimeMs: Date.now(),
			});
		});

		// Mock opendir to return an async iterable directory
		const mockOpendir = mock(() => {
			const entries: any[] = [];
			return Promise.resolve({
				[Symbol.asyncIterator]: async function* () {
					for (const entry of entries) {
						yield entry;
					}
				},
				close: () => Promise.resolve(),
			});
		});

		await mock.module("node:fs/promises", () => ({
			stat: statMock,
			mkdir: mock(() => Promise.resolve()),
			opendir: mockOpendir,
			unlink: mock(() => Promise.resolve()),
			copyFile: mock(() => Promise.resolve()),
			rename: mock(() => Promise.resolve()),
			exists: mock(() => Promise.resolve(true)),
			rm: mock(() => Promise.resolve()),
		}));

		// Mock createReadStream and createWriteStream for file operations
		await mock.module("node:fs", () => {
			return {
				createReadStream: mock(() => {
					return Readable.from(Buffer.from("test content"));
				}),
				createWriteStream: mock(() => {
					const writable = new Writable({
						write(_chunk, _encoding, callback) {
							callback();
						},
					});
					return writable;
				}),
			};
		});
	});

	const createDisk = (rootPath: string) => {
		const storage = new StorageImpl({}, mockDispatcher());
		const endpoint = filesystemStorage({ rootPath });
		const disk = storage.build(endpoint);
		return { disk, endpoint, storage };
	};

	describe("Windows paths", () => {
		beforeEach(() => {
			mockPlatformPaths("win32");
		});

		test("file.info() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const file = disk.directory("foo").file("bar.txt");

			await file.info();

			expect(fs.stat).toHaveBeenCalledTimes(1);
			expect(fs.stat).toHaveBeenCalledWith("C:\\storage\\foo\\bar.txt");
		});

		test("Windows filesystem path work with drive prefix", async () => {
			const { disk } = createDisk("D:");
			const file = disk.directory("foo").file("bar.txt");

			await file.info();

			expect(fs.stat).toHaveBeenCalledTimes(1);
			expect(fs.stat).toHaveBeenCalledWith("D:\\foo\\bar.txt");
		});

		test("Windows filesystem path work with slash-terminated root", async () => {
			const { disk } = createDisk("C:\\storage\\");
			const file = disk.directory("foo").file("bar.txt");

			await file.info();

			expect(fs.stat).toHaveBeenCalledTimes(1);
			expect(fs.stat).toHaveBeenCalledWith("C:\\storage\\foo\\bar.txt");
		});

		test("Windows filesystem paths work when input to directory() and file() are windows paths", async () => {
			const { disk } = createDisk("C:\\storage\\");
			const file = disk.directory("foo\\bar\\").file("quux\\baz.txt");

			await file.info();

			expect(fs.stat).toHaveBeenCalledTimes(1);
			expect(fs.stat).toHaveBeenCalledWith("C:\\storage\\foo\\bar\\quux\\baz.txt");
		});

		test("Windows filesystem path work with mixed-slash root", async () => {
			const { disk } = createDisk("C:\\storage/dir");
			const file = disk.directory("foo").file("bar.txt");

			await file.info();

			expect(fs.stat).toHaveBeenCalledTimes(1);
			expect(fs.stat).toHaveBeenCalledWith("C:\\storage\\dir\\foo\\bar.txt");
		});

		test("file.exists() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const file = disk.directory("foo").file("bar.txt");

			await file.exists();

			expect(fs.exists).toHaveBeenCalledTimes(1);
			expect(fs.exists).toHaveBeenCalledWith("C:\\storage\\foo\\bar.txt");
		});

		test("file.delete() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const file = disk.directory("foo").file("bar.txt");

			await file.delete();

			expect(fs.unlink).toHaveBeenCalledTimes(1);
			expect(fs.unlink).toHaveBeenCalledWith("C:\\storage\\foo\\bar.txt");
		});

		test("file.get() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const file = disk.directory("foo").file("bar.txt");

			await file.get();

			expect(fs.stat).toHaveBeenCalledTimes(1);
			expect(fs.stat).toHaveBeenCalledWith("C:\\storage\\foo\\bar.txt");
		});

		test("file.put() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const file = disk.directory("foo").file("bar.txt");

			await file.put("content");

			expect(fs.mkdir).toHaveBeenCalledWith("C:\\storage\\foo", { recursive: true });
			expect(nodefs.createWriteStream).toHaveBeenCalledWith("C:\\storage\\foo\\bar.txt");
		});

		test("file.copyTo() converts POSIX storage paths to Windows filesystem paths", async () => {
			const { disk } = createDisk("C:\\storage");
			const file = disk.directory("foo").file("bar.txt");
			const dest = disk.directory("dest").file("copied.txt");

			await file.copyTo(dest);

			expect(fs.mkdir).toHaveBeenCalledWith("C:\\storage\\dest", { recursive: true });
			expect(fs.copyFile).toHaveBeenCalledWith(
				"C:\\storage\\foo\\bar.txt",
				"C:\\storage\\dest\\copied.txt",
			);
		});

		test("file.moveTo() converts POSIX storage paths to Windows filesystem paths", async () => {
			const { disk } = createDisk("C:\\storage");
			const file = disk.directory("foo").file("bar.txt");
			const dest = disk.directory("dest").file("moved.txt");

			await file.moveTo(dest);

			expect(fs.mkdir).toHaveBeenCalledWith("C:\\storage\\dest", { recursive: true });
			expect(fs.rename).toHaveBeenCalledWith(
				"C:\\storage\\foo\\bar.txt",
				"C:\\storage\\dest\\moved.txt",
			);
		});

		test("directory.exists() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const dir = disk.directory("foo/bar");

			await dir.exists();

			// existsAnyUnderPrefix calls opendir to check for any entries
			expect(fs.opendir).toHaveBeenCalled();
			const call = (fs.opendir as ReturnType<typeof mock>).mock.calls[0];
			expect(call[0]).toBe("C:\\storage\\foo\\bar\\");
		});

		test("directory.list() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const dir = disk.directory("foo/bar");

			await dir.list();

			expect(fs.opendir).toHaveBeenCalledTimes(1);
			expect(fs.opendir).toHaveBeenCalledWith("C:\\storage\\foo\\bar\\");
		});

		test("directory.listFiles() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const dir = disk.directory("foo/bar");

			await dir.listFiles();

			expect(fs.opendir).toHaveBeenCalledTimes(1);
			expect(fs.opendir).toHaveBeenCalledWith("C:\\storage\\foo\\bar\\");
		});

		test("directory.listFiles({recursive:true}) converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const dir = disk.directory("foo/bar");

			await dir.listFiles({ recursive: true });

			expect(fs.opendir).toHaveBeenCalledTimes(1);
			expect(fs.opendir).toHaveBeenCalledWith("C:\\storage\\foo\\bar\\");
		});

		test("directory.deleteAll() converts POSIX storage path to Windows filesystem path", async () => {
			const { disk } = createDisk("C:\\storage");
			const dir = disk.directory("foo/bar");

			await dir.deleteAll();

			expect(fs.rm).toHaveBeenCalledWith("C:\\storage\\foo\\bar\\", {
				recursive: true,
				force: true,
			});
		});
	});
});
