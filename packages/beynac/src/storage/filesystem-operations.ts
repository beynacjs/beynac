/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import { onResetAllMocks } from "../testing";

// Re-export types
export type { Dir, ReadStream, Stats, WriteStream } from "node:fs";

/**
 * Interface for filesystem operations used by storage adapters
 */
export type FilesystemOps = {
	stat(this: void, path: string): Promise<fs.Stats>;
	mkdir(this: void, path: string, options?: fs.MakeDirectoryOptions): Promise<unknown>;
	opendir(this: void, path: string): Promise<fs.Dir>;
	unlink(this: void, path: string): Promise<void>;
	copyFile(this: void, source: string, destination: string): Promise<void>;
	rename(this: void, oldPath: string, newPath: string): Promise<void>;
	exists(this: void, path: string): Promise<boolean>;
	rm(this: void, path: string, options?: fs.RmOptions): Promise<void>;
	createReadStream(this: void, path: string): fs.ReadStream;
	createWriteStream(this: void, path: string): fs.WriteStream;
};

const realFs: FilesystemOps = {
	stat: fsPromises.stat,
	mkdir: fsPromises.mkdir,
	opendir: fsPromises.opendir,
	unlink: fsPromises.unlink,
	copyFile: fsPromises.copyFile,
	rename: fsPromises.rename,
	exists: fsPromises.exists,
	rm: fsPromises.rm,
	createReadStream: fs.createReadStream,
	createWriteStream: fs.createWriteStream,
};

let currentFs: FilesystemOps = realFs;

/**
 * Filesystem operations object that delegates to the current implementation.
 * By default uses real filesystem operations, but can be mocked for testing.
 * Uses getters so that fsOps.stat === currentFs.stat (important for testing with mocks)
 */
export const fsOps: FilesystemOps = {
	get stat() {
		return currentFs.stat;
	},
	get mkdir() {
		return currentFs.mkdir;
	},
	get opendir() {
		return currentFs.opendir;
	},
	get unlink() {
		return currentFs.unlink;
	},
	get copyFile() {
		return currentFs.copyFile;
	},
	get rename() {
		return currentFs.rename;
	},
	get exists() {
		return currentFs.exists;
	},
	get rm() {
		return currentFs.rm;
	},
	get createReadStream() {
		return currentFs.createReadStream;
	},
	get createWriteStream() {
		return currentFs.createWriteStream;
	},
};

/**
 * Mock filesystem operations for testing.
 * Pass a FilesystemOps implementation (typically with mock() functions from tests).
 *
 * @internal
 */
export function mockFilesystemOperations(ops: FilesystemOps): void {
	currentFs = ops;
	onResetAllMocks(() => {
		currentFs = realFs;
	});
}
