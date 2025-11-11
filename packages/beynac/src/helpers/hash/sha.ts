import { createHash } from "node:crypto";
import { mockable } from "../../testing/mocks";

/**
 * Hash data using SHA-256
 */
export const sha256: (data: string | Uint8Array) => string = mockable(function sha256(
	data: string | Uint8Array,
): string {
	const hash = createHash("sha256");
	hash.update(data);
	return hash.digest("hex");
});
