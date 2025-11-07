import { mock } from "bun:test";
import type {
	StorageDirectory,
	StorageDirectoryOperations,
	StorageDisk,
	StorageEndpoint,
	StorageFile,
} from "../contracts/Storage";

/**
 * Creates a mock StorageEndpoint with all methods stubbed.
 * Useful for testing that implementations correctly delegate to the endpoint.
 */
export function mockStorageEndpoint(name = "mock"): StorageEndpoint {
	return {
		name,
		supportsMimeTypes: true,
		invalidNameChars: "",
		readSingle: mock(async () => new Response()),
		writeSingle: mock(async () => {}),
		getInfoSingle: mock(async () => null),
		getSignedDownloadUrl: mock(async () => ""),
		getTemporaryUploadUrl: mock(async () => ""),
		copy: mock(async () => {}),
		move: mock(async () => {}),
		existsSingle: mock(async () => false),
		existsAnyUnderPrefix: mock(async () => false),
		listFiles: mock(async () => []),
		listDirectories: mock(async () => []),
		deleteSingle: mock(async () => {}),
		deleteAllUnderPrefix: mock(async () => {}),
	};
}

/**
 * Creates a mock StorageDirectoryOperations with all methods stubbed.
 * Useful for testing that implementations correctly delegate to directory operations.
 */
export function mockStorageDirectory(): StorageDirectoryOperations {
	// Create mock file and directory objects to return
	const mockFile: StorageFile = {
		type: "file",
		disk: {} as unknown as StorageDisk,
		path: "",
		delete: mock(async () => {}),
		exists: mock(async () => false),
		fetch: mock(async () => new Response()),
		info: mock(async () => null),
		url: mock(async () => ""),
		put: mock(async () => ({ actualName: "", actualPath: "" })),
		copyTo: mock(async () => ({ actualName: "", actualPath: "" })),
		uploadUrl: mock(async () => ""),
	};

	const mockDirectory: StorageDirectory = {
		type: "directory",
		disk: {} as unknown as StorageDisk,
		path: "",
		exists: mock(async () => false),
		files: mock(async () => []),
		allFiles: mock(async () => []),
		directories: mock(async () => []),
		allDirectories: mock(async () => []),
		deleteAll: mock(async () => {}),
		directory: mock(() => mockDirectory),
		file: mock(() => mockFile),
		putFile: mock(async () => mockFile),
	};

	return {
		exists: mock(async () => false),
		files: mock(async () => []),
		allFiles: mock(async () => []),
		directories: mock(async () => []),
		allDirectories: mock(async () => []),
		deleteAll: mock(async () => {}),
		directory: mock(() => mockDirectory),
		file: mock(() => mockFile),
		putFile: mock(async () => mockFile),
	};
}

/**
 * Extracts the names of methods that were called on a mock endpoint.
 * Useful for verifying that only expected methods were invoked.
 */
export function getCalledMethodNames(mockEndpoint: StorageEndpoint): string[] {
	const methodNames: (keyof StorageEndpoint)[] = [
		"readSingle",
		"writeSingle",
		"getInfoSingle",
		"getSignedDownloadUrl",
		"getTemporaryUploadUrl",
		"copy",
		"move",
		"existsSingle",
		"existsAnyUnderPrefix",
		"listFiles",
		"listDirectories",
		"deleteSingle",
		"deleteAllUnderPrefix",
	];

	return methodNames.filter((name) => {
		const method = mockEndpoint[name];
		const mockCalls = (method as unknown as { mock?: { calls?: unknown[] } }).mock?.calls;
		return typeof method === "function" && mockCalls !== undefined && mockCalls.length > 0;
	});
}
