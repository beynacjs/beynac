import { createTypeToken, type TypeToken } from "../container/container-key";

/**
 * A manager for storage disks
 *
 * Directory operations like allFiles() can be used on this object and will be
 * sent to the default disk
 */
export interface Storage extends StorageDirectoryOperations {
	/**
	 * Resolve a disk by name. If no name is provided, the default disk will be used.
	 */
	disk(name?: string): StorageDisk;

	/**
	 * Create a new disk at runtime. Useful for one-off operations, e.g.
	 * uploading a file to an S3 that was not specified in your application
	 * configuration
	 */
	build(endpoint: StorageEndpoint): StorageDisk;

	/**
	 * Replace a disk with one backed by a tempory directory that will be
	 * cleaned up when the process exits.
	 */
	mock(diskName: string): void;
}

/**
 * A place that you can store files.
 *
 * Disks share the same API as directories, you can use all methods from the
 * StorageDirectory interface to access the root directory.
 *
 * @example
 * const disk = storage.disk('local');
 * const files = await disk.allFiles();
 * ```
 */
export interface StorageDisk extends StorageDirectoryOperations {
	readonly name: string;
}

export type StorageEntry = StorageFile | StorageDirectory;

export interface StorageEntryCommon {
	readonly disk: StorageDisk;
	readonly path: string;
}

interface CommonUrlOptions {
	/**
	 * Generate a signed URL with expiration on drivers that support it (s3).
	 * Other drivers will ignore this option - if the file is public, the URL
	 * will work, otherwise it will not be accessible.
	 *
	 * If you do not want your links to expire, just set a very far future
	 * expiration date.
	 *
	 * Strings can be in the format "1h" or "5d4h", and represent A time
	 * duration in the future after the URL is generated. Supported units are y,
	 * m, d, h, s, and ms units.
	 */
	expires?: string | Date | undefined;
}

export interface DownloadUrlOptions extends CommonUrlOptions {
	/**
	 * Set the download file name on drivers that support it (s3). Other
	 * drivers will ignore the option.
	 *
	 * This sets a header `Content-Disposition: attachment; filename="[value of downloadAs]"` on the response.
	 */
	downloadAs?: string | undefined;
}

export interface UploadUrlOptions extends CommonUrlOptions {}

export interface StorageFileInfo {
	size: number;
	mimeType: string;
	etag: string;
}

export interface StorageFile extends StorageEntryCommon {
	readonly type: "file";

	/**
	 * Delete the file, if it exists.
	 *
	 * This method will throw if it fails to delete the file, for example due
	 * to permissions errors. If the file does not exist, that
	 * is not considered an error.
	 */
	delete(): Promise<void>;

	/**
	 * Check if this file exists.
	 */
	exists(): Promise<boolean>;

	/**
	 * Fetch this file and return a web-standard Response object.
	 *
	 * All drivers will set the Content-Type and Content-Length headers on
	 * the response. Drivers may set other headers.
	 *
	 * NOTE: unlike the fetch() API, if this method checks to see if a
	 * response is sucessful before returning it. In the event that the
	 * response fails, an error will be thrown.
	 */
	// TEST: epected headers set
	fetch(): Promise<Response>;

	/**
	 * Get metadata on this file. Returns null if no file exists.
	 */
	info(): Promise<StorageFileInfo | null>;

	/**
	 * Generate a URL to access this file publicly.
	 */
	// TEST: expires accepts string patterns
	// TEST: expires accepts Date
	url(options?: DownloadUrlOptions): Promise<string>;

	/**
	 * Upload data to the file. If the file does not exist, it will be
	 * created. If the file exists, it will be overwritten.
	 *
	 * @param payload.data - a source of binary data, any BodyInit value that can be passed to a web fetch request is supported: string, Blob, ArrayBuffer, ArrayBufferView (including UInt8Array), FormData, URLSearchParams, ReadableStream and File
	 * @param payload.mimeType - a valid mime type e.g. "image/png".
	 * @param payload.suggestedName [optional] - a suggested name for the file - the actual name may be different depending on the driver, and if so will be returned in the result. If omitted, a unique name will be generated.
	 *
	 * If you pass a File or Request object, the driver will obtain a
	 * suggested name from the X-File-Name header or "filename" attribute of
	 * the Content-Disposition header, and a mimeTYpe from the Content-Type header.
	 */
	// TEST: header and content type inference
	put(payload: StoragePutPayload | File | Request): Promise<StoragePutResponse>;

	/**
	 * Copy the file to another location.
	 *
	 * If the destination is in the same driver, then the
	 */
	copyTo(destination: StorageFile): Promise<StoragePutResponse>;

	/**
	 * Generate a URL to access this file publicly.
	 */
	// TEST: expires accepts string patterns
	// TEST: expires accepts Date
	uploadUrl(options?: UploadUrlOptions): Promise<string>;
}

export interface StoragePutPayload {
	// TEST: supports all 4 types of StorageFulPutPayload
	data:
		| string
		| Blob
		| ArrayBuffer
		| ArrayBufferView
		| FormData
		| URLSearchParams
		| ReadableStream
		| File;
	mimeType: string;
	suggestedName?: string;
}

export interface StoragePutResponse {
	/**
	 * The name that the file was saved with. Storage providers that do not
	 * support MIME types, like the file system driver, need to ensure that the
	 * MIME type matches the extension. If it was necessary to change the
	 * extension, the actual name will reflect that. It is necessary to use the
	 * actual name to
	 */
	actualName: string;
	actualPath: string;
}

export interface StorageDirectory extends StorageEntryCommon, StorageDirectoryOperations {
	readonly type: "directory";
}

export interface StorageDirectoryOperations {
	/**
	 * Check if there are any files with this directory's prefix.
	 *
	 * NOTE: in Beynac, directories are simply references to a common prefix
	 * for files. There is no such thing as an empty directory. Checking if a
	 * directory exists is equivalent to checking whether there are any files
	 * with its prefix. When the last file is removed, the directory will
	 * cease to exist.
	 */
	exists(): Promise<boolean>;

	/**
	 * List files that are direct children of this directory.
	 */
	files(): Promise<StorageFile[]>;

	/**
	 * List all files within this directory, recursively.
	 */
	allFiles(): Promise<StorageFile[]>;

	/**
	 * List directories that are direct children of this directory.
	 */
	directories(): Promise<StorageDirectory[]>;

	/**
	 * List all directories within this directory, recursively.
	 */
	allDirectories(): Promise<StorageDirectory[]>;

	/**
	 * Delete all files within this directory, recursively.
	 *
	 * This is equivalent to deleting the directory, since in Beynac there is
	 * no concept of an empty directory.
	 */
	deleteAll(): Promise<void>;

	/**
	 * Return a directory reference by resolving a path relative to this directory.
	 *
	 * If the path does not end with a slash, one will be added
	 *
	 * @path a directory name e.g. "pokemon" or path e.g. "pokemon/pikachu/images"
	 */
	// TEST: path can start with a slash or not and it will be joined with this directory's path
	// TEST: path can end with a slash or not and one will be added if it's misssing
	directory(path: string): StorageDirectory;

	/**
	 * Return a file reference by resolving a path relative to this directory.
	 *
	 * @path a directory name e.g. "pokemon" or set of them e.g. "pokemon/pikachu/images"
	 */
	// TEST: path can start with a slash or not and it will be joined with this directory's path
	// TEST: path can end with a slash or not and one will be removed if it's present
	file(path: string): StorageFile;
}

export interface StorageEndpointWriteOptions {
	path: string;
	data:
		| string
		| Blob
		| ArrayBuffer
		| ArrayBufferView
		| FormData
		| URLSearchParams
		| ReadableStream
		| File;
	mimeType: string;
	suggestedName: string;
}

/**
 * A connection to a specific storage location, e.g. a local directory or S3 bucket.
 */
export interface StorageEndpoint {
	/**
	 * Read a file, returning the web-standaed response e.g. from the fetch() call used to make the request
	 */
	readSingle(path: string): Promise<Response>;

	/**
	 * Whether this endpoint supports MIME types. If it does not, then the
	 * Content-Type of readSingle() responses will be ignored and MIME type
	 * inferred from the file extension.
	 */
	supportsMimeTypes: boolean;

	/**
	 * A string containing chars that are invalid in filenames, e.g. `'<>:"/\\|?*'`
	 */
	invalidFilenameChars: string;

	/**
	 * Write a file.
	 */
	writeSingle(options: StorageEndpointWriteOptions): Promise<void>;

	/**
	 * Get information about a file.
	 */
	getInfoSingle(path: string): Promise<StorageFileInfo | null>;

	/**
	 * Get a temporary download URL for a path.
	 */
	getTemporaryDownloadUrl(path: string, expires: Date, downloadFileName?: string): Promise<string>;

	/**
	 * Get a temporary upload URL for a path.
	 */
	getTemporaryUploadUrl(path: string, expires: Date): Promise<string>;

	/**
	 * Copy a file from one path to another. Should throw if the source file does not exist.
	 */
	copy(source: string, destination: string): Promise<void>;

	/**
	 * Copy a file internally within this endpoint. Should throw if the source file does not exist.
	 */
	move(source: string, destination: string): Promise<void>;

	/**
	 * Check if a file exists at the given path.
	 */
	existsSingle(path: string): Promise<boolean>;

	/**
	 * Check if any file exists under the given prefix
	 */
	existsAnyUnderPrefix(prefix: string): Promise<boolean>;

	/**
	 * List all files under a prefix. The prefix will be a directory name
	 * ending with a forward slash. The prefix does not have to exist, in
	 * this case, the result will be an empty string.
	 */
	listFiles(prefix: string, recursive: boolean): Promise<string[]>;

	/**
	 * List all directories under a prefix. The prefix will be a directory name
	 * ending with a forward slash. The prefix does not have to exist, in
	 * this case, the result will be an empty string.
	 */
	listDirectories(prefix: string, recursive: boolean): Promise<string[]>;

	/**
	 * Delete a single file.
	 */
	deleteSingle(path: string): Promise<void>;

	/**
	 * Delete all files under a prefix.
	 */
	deleteAllUnderPrefix(prefix: string): Promise<void>;
}

export const Storage: TypeToken<Storage> = createTypeToken("Storage");
