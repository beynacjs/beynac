import { createHash } from "node:crypto";

/**
 * Hash data using SHA-256
 */
export function sha256(data: string | Uint8Array): string {
	const hash = createHash("sha256");
	hash.update(data);
	return hash.digest("hex");
}
