/**
 * Configuration for the memory driver
 */
export interface MemoryStorageConfig {
	/**
	 * Pre-populate the driver with initial files. Useful for test fixtures.
	 *
	 * Values can be:
	 * - A string (mimeType defaults to "text/plain")
	 * - An object with data and optional mimeType
	 *
	 * @example
	 * initialFiles: {
	 *   'readme.txt': 'Hello world',
	 *   'users/avatar.png': { data: avatarBytes },
	 * }
	 */
	initialFiles?:
		| Record<
				string,
				| string
				| {
						data: string | ArrayBuffer | ArrayBufferView | null | undefined;
						mimeType?: string | null | undefined;
				  }
		  >
		| undefined;

	/**
	 * Whether this driver supports MIME types - if not then the system infer
	 * them from file extensions
	 */
	supportsMimeTypes?: boolean | undefined;

	/**
	 * A string containing characters that are invalid in filenames.
	 * Files will have these characters replaced with underscores.
	 * Default: "" (no invalid characters)
	 *
	 * @example
	 * invalidNameChars: '<>:"/\\|?*' // Windows-style restrictions
	 */
	invalidNameChars?: string | undefined;
}
