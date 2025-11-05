/**
 * Extract filename from a File object
 *
 * @param file - The File object
 * @returns Suggested filename, or undefined if not available
 */
export function getNameFromFile(_file: File): string | undefined {
	throw new Error("Not implemented");
}

/**
 * Extract filename from a Request object
 *
 * Checks X-File-Name header and Content-Disposition header for filename.
 *
 * @param request - The Request object
 * @returns Suggested filename, or undefined if not available
 */
export function getNameFromRequest(_request: Request): string | undefined {
	throw new Error("Not implemented");
}
