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
	 *
	 * @param endpoint a storage driver configuration e.g. filesystemStorage({... config ...})
	 * @param name an optional disk name for debugging
	 */
	build(endpoint: StorageEndpoint, name?: string): StorageDisk;

	/**
	 * Replace a disk with one backed by a temporary directory that will be
	 * cleaned up when the process exits.
	 */
	mock(diskName: string): void;

	/**
	 * Restore all mocked disks to their original endpoints.
	 */
	resetMocks(): void;
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

interface SignUrlOptions {
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

interface DownloadUrlOptions {
	/**
	 * Set the download file name on drivers that support it (s3). Other
	 * drivers will ignore the option.
	 *
	 * This sets a header `Content-Disposition: attachment; filename="[value of downloadAs]"` on the response.
	 */
	downloadAs?: string | undefined;
}

export interface StorageFileInfo {
	size: number;
	mimeType: string;
	etag: string;
}

export type StorageFileUrlOptions = DownloadUrlOptions;
export type StorageFileSignedUrlOptions = SignUrlOptions & DownloadUrlOptions;
export type StorageFileUploadUrlOptions = SignUrlOptions;

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
	 * Fetch this file and on success return a web-standard Response object.
	 *
	 * All drivers will set the Content-Type and Content-Length headers on
	 * the response. Drivers may set other headers.
	 *
	 * Unlike the fetch() API, this method will only return a response on
	 * success. On failure, an appropriate kind of error will be thrown, e.g.
	 * NotFoundError or PermissionsError.
	 */
	fetch(): Promise<Response>;

	/**
	 * Get metadata on this file. Returns null if no file exists.
	 */
	info(): Promise<StorageFileInfo | null>;

	/**
	 * Get the URL at which this file can be accessed.
	 *
	 * This will be a regular unsigned URL and so relies on the file being publicly accessible.
	 *
	 * @param [options.downloadAs] - The suggested filename for the file, for s3. Storage drivers that do not support suggested download names will ignore this option.
	 */
	url(options?: DownloadUrlOptions): Promise<string>;

	/**
	 * Generate a signed URL to allow access to this file.
	 *
	 * @param [options.downloadAs] - The suggested filename for the file, for s3. Storage drivers that do not support suggested download names will ignore this option.
	 * @param [options.expires] - A Date defining expiry time, or string in the format "1h" or "5d4h" representing a duration into the future
	 */
	signedUrl(options?: DownloadUrlOptions & SignUrlOptions): Promise<string>;

	/**
	 * Generate a URL that clients can POST data to to upload file content.
	 *
	 * @param [options.expires] - A Date defining expiry time, or string in the format "1h" or "5d4h" representing a duration into the future
	 */
	uploadUrl(options?: SignUrlOptions): Promise<string>;

	/**
	 * Upload data to the file. If the file does not exist, it will be
	 * created. If the file exists, it will be overwritten.
	 *
	 * The file already has a name (its path), so this method does not
	 * accept a suggestedName. To upload a file with a suggested name that
	 * may be sanitised, use directory.putFile() instead.
	 *
	 * @param payload.data - a source of binary data, any BodyInit value that can be passed to a web fetch request is supported: string, Blob, ArrayBuffer, ArrayBufferView (including UInt8Array), FormData, URLSearchParams, ReadableStream and File
	 * @param payload.mimeType - a valid mime type e.g. "image/png".
	 *
	 * If you pass a File or Request object, the mimeType will be obtained
	 * from the Content-Type header.
	 */
	put(payload: StorageFilePutPayload | File | Request): Promise<void>;

	/**
	 * Copy the file to another location.
	 *
	 * If the destination is on the same disk, the copy is performed efficiently using
	 * the driver's copy() method. Otherwise, the file is fetched and then written
	 * to the destination.
	 */
	copyTo(destination: StorageFile): Promise<void>;

	/**
	 * Move the file to another location.
	 *
	 * If the destination is on the same disk, the move is performed efficiently using
	 * the driver's move() method. Otherwise, the file is copied to the destination
	 * and then deleted from the source.
	 */
	moveTo(destination: StorageFile): Promise<void>;
}

export type StorageData =
	| ReadableStream
	| Blob
	| ArrayBufferView
	| ArrayBuffer
	| FormData
	| URLSearchParams
	| string;

export interface StorageFilePutPayload {
	data: StorageData;
	mimeType: string;
}

export interface StorageDirectory extends StorageEntryCommon, StorageDirectoryOperations {
	readonly type: "directory";
}

type FileSanitiseOptions = {
	onInvalid?: "convert" | "throw";
};

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
	 * By default, handles invalid filenames by generating a unique valid
	 * filename. This can cause surprising results if you write files using
	 * this API then try to read them using a different system. For example,
	 * if you try to save a file called "test:file" to a filesystem that
	 * doesn't support colons, the file will be saved as
	 * "test_file-3c5b0673" (3c5b0673 is a hash of the original name).
	 *
	 * @param [options.onInvalid] - "convert" to generate valid file names (the default), or "error" to throw an error
	 *
	 * @path a directory name e.g. "pokemon" or path e.g. "pokemon/pikachu/images"
	 */
	directory(path: string, options?: FileSanitiseOptions): StorageDirectory;

	/**
	 * Return a file reference by resolving a path relative to this directory.
	 *
	 * Slashes in the filename are interpreted as directory names, so
	 * "foo/bar.txt" returns a file in the "foo" subdirectory.
	 *
	 * By default, handles invalid filenames by generating a unique valid
	 * filename. This can cause surprising results if you write files using
	 * this API then try to read them using a different system. For example,
	 * if you try to save a file called "test:file" to a filesystem that
	 * doesn't support colons, the file will be saved as
	 * "test_file-3c5b0673" (3c5b0673 is a hash of the original name).
	 *
	 * @param [options.onInvalid] - "convert" to generate valid file names (the default), or "error" to throw an error
	 *
	 * @path a filename e.g. "image.png"
	 */
	file(path: string, options?: FileSanitiseOptions): StorageFile;

	/**
	 * Upload a file to this directory. The name may be changed to match the
	 * rules of the storage disk, removing invalid characters and adding a
	 * valid extension if required
	 *
	 * @param payload.data - a source of binary data
	 * @param payload.mimeType - a valid mime type e.g. "image/png"
	 * @param payload.suggestedName - optional suggested filename
	 *
	 * If you pass a File or Request object, the driver will obtain a
	 * suggested name from the X-File-Name header or "filename" attribute of
	 * the Content-Disposition header, and a mimeType from the Content-Type header.
	 * Names from File or Request objects are trimmed of whitespace.
	 *
	 * @returns The StorageFile object with the actual filename used
	 */
	putFile(
		payload: (StorageFilePutPayload & { suggestedName?: string | undefined }) | File | Request,
	): Promise<StorageFile>;
}

export interface StorageEndpointWriteOptions {
	path: string;
	data: StorageData;
	mimeType: string;
}

export interface StorageEndpointFileInfo {
	contentLength: number;
	mimeType?: string;
	etag: string;
}

/**
 * A connection to a specific storage location, e.g. a local directory or S3 bucket.
 */
export interface StorageEndpoint {
	/**
	 * Name of this endpoint for identification purposes (e.g. "memory", "s3", "local")
	 */
	name: string;

	/**
	 * Read a file, returning the web-standard response e.g. from the fetch() call used to make the request
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
	invalidNameChars: string;

	/**
	 * Write a file.
	 */
	writeSingle(options: StorageEndpointWriteOptions): Promise<void>;

	/**
	 * Get information about a file.
	 */
	getInfoSingle(path: string): Promise<StorageEndpointFileInfo | null>;

	/**
	 * Get an unsigned URL that will work to download this file if it is public.
	 */
	getPublicDownloadUrl(path: string, downloadFileName?: string): Promise<string>;

	/**
	 * Get a temporary download URL for a path.
	 */
	getSignedDownloadUrl(path: string, expires: Date, downloadFileName?: string): Promise<string>;

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
	 *
	 * This operation does not throw an error if the file does not exist.
	 */
	deleteSingle(path: string): Promise<void>;

	/**
	 * Delete all files under a prefix.
	 */
	deleteAllUnderPrefix(prefix: string): Promise<void>;
}

export const Storage: TypeToken<Storage> = createTypeToken("Storage");
