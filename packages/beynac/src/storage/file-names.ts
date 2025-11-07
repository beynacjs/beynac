import { basename, extname } from "node:path";
import { regExpEscape } from "../utils";

/**
 * MIME type and file name handling for storage operations.
 * Based on Chrome's primary and secondary MIME type mappings.
 */

/**
 * Primary MIME type mappings - these are enforced when supportsMimeTypes is false.
 * Extensions in this list will be automatically appended/corrected if missing or incorrect.
 */
const primaryMappings = [
	{ mime: "video/webm", extensions: ["webm"] },
	{ mime: "audio/mpeg", extensions: ["mp3"] },
	{ mime: "video/mp4", extensions: ["mp4", "m4v"] },
	{ mime: "audio/mp4", extensions: ["m4a"] },
	{ mime: "audio/x-m4a", extensions: ["m4a"] },
	{ mime: "video/ogg", extensions: ["ogv", "ogm"] },
	{ mime: "audio/ogg", extensions: ["ogg", "oga", "opus"] },
	{ mime: "audio/x-vorbis+ogg", extensions: ["ogg"] },
	{ mime: "video/x-ogm+ogg", extensions: ["ogm"] },
	{ mime: "audio/flac", extensions: ["flac"] },
	{ mime: "audio/wav", extensions: ["wav"] },
	{ mime: "audio/x-wav", extensions: ["wav"] },
	{ mime: "application/ogg", extensions: ["ogx"] },
	{ mime: "application/pdf", extensions: ["pdf"] },
	{ mime: "application/xml", extensions: ["xml"] },
	{ mime: "image/gif", extensions: ["gif"] },
	{ mime: "image/jpeg", extensions: ["jpeg", "jpg"] },
	{ mime: "image/png", extensions: ["png"] },
	{ mime: "image/apng", extensions: ["png"] },
	{ mime: "image/webp", extensions: ["webp"] },
	{ mime: "text/plain", extensions: ["txt"] },
	{ mime: "video/mpeg", extensions: ["mpeg", "mpg"] },
	{ mime: "video/quicktime", extensions: ["mov", "qt"] },
	{ mime: "video/x-flv", extensions: ["flv"] },
	{ mime: "image/avif", extensions: ["avif"] },
	{ mime: "image/svg+xml", extensions: ["svg", "svgz"] },
	{ mime: "image/bmp", extensions: ["bmp"] },
	{ mime: "video/3gpp", extensions: ["3gp", "3gpp", "3ga", "3gpp2", "3g2"] },
];

/**
 * Secondary MIME type mappings - used for lookup but not enforced.
 */
const secondaryMappings = [
	{ mime: "image/x-icon", extensions: ["ico"] },
	{ mime: "image/x-xbitmap", extensions: ["xbm"] },
	{ mime: "image/vnd.microsoft.icon", extensions: ["ico"] },
	{ mime: "video/x-msvideo", extensions: ["avi"] },
	{ mime: "audio/x-pn-wav", extensions: ["wav"] },
	{ mime: "text/html", extensions: ["html", "htm", "shtml", "shtm"] },
	{ mime: "application/xhtml+xml", extensions: ["xhtml", "xht", "xhtm"] },
	{ mime: "image/tiff", extensions: ["tif", "tiff"] },
	{ mime: "audio/mpeg3", extensions: ["mp3"] },
	{ mime: "audio/x-mpeg-3", extensions: ["mp3"] },
	{ mime: "audio/basic", extensions: ["au", "snd"] },
	{ mime: "audio/x-aiff", extensions: ["aif", "aiff", "aifc"] },
	{ mime: "audio/aiff", extensions: ["aif", "aiff", "aifc"] },
	{ mime: "image/x-ms-bmp", extensions: ["bmp"] },
	{ mime: "application/x-shockwave-flash", extensions: ["swf", "swl"] },
	{ mime: "application/pkcs7-mime", extensions: ["p7m", "p7c", "p7z"] },
	{ mime: "application/pkcs7-signature", extensions: ["p7s"] },
	{ mime: "text/css", extensions: ["css"] },
	{ mime: "text/xml", extensions: ["xml"] },
	{ mime: "text/javascript", extensions: ["js", "mjs"] },
	{ mime: "application/javascript", extensions: ["js", "mjs"] },
	{ mime: "application/ecmascript", extensions: ["js", "mjs"] },
	{ mime: "text/ecmascript", extensions: ["js", "mjs"] },
	{ mime: "application/json", extensions: ["json"] },
	{ mime: "application/x-x509-ca-cert", extensions: ["cer", "crt"] },
	{ mime: "application/x-x509-user-cert", extensions: ["crt"] },
	{ mime: "application/pkix-cert", extensions: ["cer", "crt"] },
	{ mime: "application/x-pem-file", extensions: ["pem"] },
	{ mime: "application/x-pkcs12", extensions: ["p12", "pfx"] },
	{ mime: "application/zip", extensions: ["zip"] },
	{ mime: "application/x-gzip", extensions: ["gz", "tgz"] },
	{ mime: "application/gzip", extensions: ["gz", "tgz"] },
	{ mime: "application/msword", extensions: ["doc", "dot"] },
	{ mime: "application/vnd.ms-excel", extensions: ["xls", "xlm", "xla", "xlc", "xlt", "xlw"] },
	{ mime: "application/vnd.ms-powerpoint", extensions: ["ppt", "pps", "pot"] },
	{
		mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		extensions: ["docx"],
	},
	{
		mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		extensions: ["xlsx"],
	},
	{
		mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		extensions: ["pptx"],
	},
	{ mime: "application/postscript", extensions: ["ps", "eps", "ai"] },
	{ mime: "application/rtf", extensions: ["rtf"] },
	{ mime: "text/csv", extensions: ["csv"] },
	{ mime: "text/calendar", extensions: ["ics"] },
	{ mime: "image/x-png", extensions: ["png"] },
	{ mime: "font/woff", extensions: ["woff"] },
	{ mime: "font/woff2", extensions: ["woff2"] },
	{ mime: "application/font-woff", extensions: ["woff"] },
	{ mime: "application/font-woff2", extensions: ["woff2"] },
	{ mime: "application/wasm", extensions: ["wasm"] },
];

/**
 * Build lookup maps from the primary and secondary mappings
 */
const mimeToExtensionPrimary = new Map<string, string>();
for (const mapping of primaryMappings) {
	const normalizedMime = mapping.mime.toLowerCase();
	if (!mimeToExtensionPrimary.has(normalizedMime)) {
		mimeToExtensionPrimary.set(normalizedMime, mapping.extensions[0]!);
	}
}

const extensionToMimeCombined = new Map<string, string>();
for (const mapping of [...primaryMappings, ...secondaryMappings]) {
	const normalizedMime = mapping.mime.toLowerCase();
	for (const ext of mapping.extensions) {
		const normalizedExt = ext.toLowerCase();
		if (!extensionToMimeCombined.has(normalizedExt)) {
			extensionToMimeCombined.set(normalizedExt, normalizedMime);
		}
	}
}

/**
 * Generate a cryptographically strong random alphanumeric ID.
 *
 * @param length - Length of the ID to generate (default: 20)
 * @returns Random alphanumeric string
 */
function generateRandomId(length = 20): string {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	const randomValues = new Uint8Array(length);
	crypto.getRandomValues(randomValues);

	let result = "";
	for (let i = 0; i < length; i++) {
		result += chars[randomValues[i]! % chars.length];
	}
	return result;
}

/**
 * Get MIME type from a filename by looking up its extension.
 *
 * Searches both primary and secondary MIME type mappings.
 * Returns "application/octet-stream" if extension is unknown.
 *
 * @param filename - Filename or path to extract extension from
 * @returns MIME type
 *
 * @example
 * mimeTypeFromFileName("file.png") // "image/png"
 * mimeTypeFromFileName("document.pdf") // "application/pdf"
 * mimeTypeFromFileName("unknown.xyz") // "application/octet-stream"
 * mimeTypeFromFileName("path/to/file.jpg") // "image/jpeg"
 */
export function mimeTypeFromFileName(filename: string): string {
	const lastDotIndex = filename.lastIndexOf(".");
	if (lastDotIndex === -1) {
		return "application/octet-stream";
	}

	const extension = filename.slice(lastDotIndex + 1).toLowerCase();
	return extensionToMimeCombined.get(extension) ?? "application/octet-stream";
}

export function createFileName(
	suggestedName: string | null | undefined,
	mimeType: string,
	supportsMimeTypes: boolean,
): string {
	let name = basename(suggestedName?.trim() || generateRandomId());

	const cleanMimeType = mimeType.split(";")[0].trim().toLowerCase();

	if (!supportsMimeTypes) {
		const expectedExtension = mimeToExtensionPrimary.get(cleanMimeType);
		if (expectedExtension) {
			const extension = extname(name);

			if (extension) {
				const currentMime = extensionToMimeCombined.get(extension);

				if (currentMime !== cleanMimeType) {
					name = `${name}.${expectedExtension}`;
				}
			} else {
				name = `${name}.${expectedExtension}`;
			}
		}
	}

	return name;
}

export function sanitiseName(name: string, invalidChars: string): string {
	invalidChars += "/";
	const regex = new RegExp(`[${regExpEscape(invalidChars)}]+`, "g");
	const replacement = invalidChars.includes("_") ? "" : "_";
	return name.replace(regex, replacement);
}
