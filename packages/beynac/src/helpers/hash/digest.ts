import { createHash } from "node:crypto";
import { mockable } from "../../testing/mocks";

type HashEncoding = "hex" | "base64";

/**
 * Hash data using SHA-256
 */
export const sha256: (data: string | Uint8Array, encoding?: HashEncoding) => string = mockable(
	function sha256(data, encoding): string {
		return doHash(data, "sha256", encoding);
	},
);

/**
 * Hash data using SHA-512
 */
export const sha512: (data: string | Uint8Array, encoding?: HashEncoding) => string = mockable(
	function sha512(data, encoding): string {
		return doHash(data, "sha512", encoding);
	},
);

/**
 * Hash data using SHA3-256
 */
export const sha3_256: (data: string | Uint8Array, encoding?: HashEncoding) => string = mockable(
	function sha3_256(data, encoding): string {
		return doHash(data, "sha3-256", encoding);
	},
);

/**
 * Hash data using SHA3-512
 */
export const sha3_512: (data: string | Uint8Array, encoding?: HashEncoding) => string = mockable(
	function sha3_512(data, encoding): string {
		return doHash(data, "sha3-512", encoding);
	},
);

/**
 * Hash data using MD5
 */
export const md5: (data: string | Uint8Array, encoding?: HashEncoding) => string = mockable(
	function md5(data, encoding): string {
		return doHash(data, "md5", encoding);
	},
);

const doHash = (
	data: string | Uint8Array,
	algorithm: string,
	encoding: HashEncoding = "hex",
): string => {
	const hash = createHash(algorithm);
	hash.update(data);
	return hash.digest(encoding);
};
