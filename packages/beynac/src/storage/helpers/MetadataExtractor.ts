import { parseAttributeHeader } from "../../helpers/headers";

/**
 * Extract filename from a File object
 *
 * @param file - The File object
 * @returns Suggested filename, or undefined if not available
 */
export function getNameFromFile(file: File): string | null {
	return file.name ?? null;
}

/**
 * Extract filename from a Request object
 *
 * Checks X-File-Name header and Content-Disposition header for filename.
 *
 * @param request - The Request object
 * @returns Suggested filename, or undefined if not available
 */
export function getNameFromRequest(request: Request): string | null {
	// Check X-File-Name header first (priority)
	const fileNameHeader = request.headers.get("X-File-Name");
	if (fileNameHeader) {
		return fileNameHeader;
	}

	// Check Content-Disposition header
	const contentDisposition = request.headers.get("Content-Disposition");
	if (contentDisposition) {
		const parsed = parseAttributeHeader(contentDisposition);
		if (parsed.attributes.filename) {
			return parsed.attributes.filename;
		}
	}

	return null;
}
