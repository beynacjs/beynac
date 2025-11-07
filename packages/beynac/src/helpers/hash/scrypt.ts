import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { formatPhc, parsePhc } from "./phc";

/**
 * Options for scrypt hashing
 */
export interface ScryptOptions {
	/** CPU/memory cost parameter (must be power of 2, default: 16384) */
	N?: number | undefined;
	/** Block size parameter (default: 8) */
	r?: number | undefined;
	/** Parallelization parameter (default: 1) */
	p?: number | undefined;
	/** Length of derived key in bytes (default: 32) */
	keyLen?: number | undefined;
}

const DEFAULT_SCRYPT_OPTIONS = {
	N: 16384,
	r: 8,
	p: 1,
	keyLen: 32,
} as const;

/**
 * Asynchronously hash a password using scrypt
 */
export async function hashScrypt(password: string, options?: ScryptOptions): Promise<string> {
	const N: number = typeof options?.N === "number" ? options.N : DEFAULT_SCRYPT_OPTIONS.N;
	const r: number = typeof options?.r === "number" ? options.r : DEFAULT_SCRYPT_OPTIONS.r;
	const p: number = typeof options?.p === "number" ? options.p : DEFAULT_SCRYPT_OPTIONS.p;
	const keyLen: number =
		typeof options?.keyLen === "number" ? options.keyLen : DEFAULT_SCRYPT_OPTIONS.keyLen;
	const salt = randomBytes(16);

	return new Promise((resolve, reject) => {
		scrypt(password, salt, keyLen, { N, r, p }, (err, derivedKey) => {
			if (err) {
				reject(err);
			} else {
				resolve(
					formatPhc({
						id: "scrypt",
						params: { ln: Math.log2(N), r, p },
						salt,
						hash: derivedKey,
					}),
				);
			}
		});
	});
}

/**
 * Synchronously hash a password using scrypt
 */
export function hashScryptSync(password: string, options?: ScryptOptions): string {
	const N: number = typeof options?.N === "number" ? options.N : DEFAULT_SCRYPT_OPTIONS.N;
	const r: number = typeof options?.r === "number" ? options.r : DEFAULT_SCRYPT_OPTIONS.r;
	const p: number = typeof options?.p === "number" ? options.p : DEFAULT_SCRYPT_OPTIONS.p;
	const keyLen: number =
		typeof options?.keyLen === "number" ? options.keyLen : DEFAULT_SCRYPT_OPTIONS.keyLen;
	const salt = randomBytes(16);
	const derivedKey = scryptSync(password, salt, keyLen, { N, r, p });
	return formatPhc({
		id: "scrypt",
		params: { ln: Math.log2(N), r, p },
		salt,
		hash: derivedKey,
	});
}

/**
 * Asynchronously verify a password against a scrypt hash
 */
export async function verifyScrypt(password: string, hash: string): Promise<boolean> {
	const phc = parsePhc(hash);

	if (phc.id !== "scrypt") {
		throw new Error(`Expected scrypt hash, got ${phc.id}`);
	}
	if (!phc.salt || !phc.hash) {
		throw new Error("Invalid scrypt hash: missing salt or hash");
	}

	const ln = phc.params.ln;
	if (typeof ln !== "number") {
		throw new Error("Invalid scrypt hash: ln parameter must be a number");
	}
	const r = phc.params.r;
	if (typeof r !== "number") {
		throw new Error("Invalid scrypt hash: r parameter must be a number");
	}
	const p = phc.params.p;
	if (typeof p !== "number") {
		throw new Error("Invalid scrypt hash: p parameter must be a number");
	}

	const N = 2 ** ln;

	return new Promise((resolve, reject) => {
		scrypt(password, phc.salt as Buffer, phc.hash!.length, { N, r, p }, (err, testKey) => {
			if (err) {
				reject(err);
			} else {
				resolve(timingSafeEqual(phc.hash as Buffer, testKey));
			}
		});
	});
}

/**
 * Synchronously verify a password against a scrypt hash
 */
export function verifyScryptSync(password: string, hash: string): boolean {
	const phc = parsePhc(hash);

	if (phc.id !== "scrypt") {
		throw new Error(`Expected scrypt hash, got ${phc.id}`);
	}
	if (!phc.salt || !phc.hash) {
		throw new Error("Invalid scrypt hash: missing salt or hash");
	}

	const ln = phc.params.ln;
	if (typeof ln !== "number") {
		throw new Error("Invalid scrypt hash: ln parameter must be a number");
	}
	const r = phc.params.r;
	if (typeof r !== "number") {
		throw new Error("Invalid scrypt hash: r parameter must be a number");
	}
	const p = phc.params.p;
	if (typeof p !== "number") {
		throw new Error("Invalid scrypt hash: p parameter must be a number");
	}

	const N = 2 ** ln;

	const testKey = scryptSync(password, phc.salt, phc.hash.length, { N, r, p });
	return timingSafeEqual(phc.hash, testKey);
}

/**
 * Hash data using SHA-256
 * @param data - String or Uint8Array to hash
 * @returns Promise resolving to lowercase hex-encoded hash
 */
export async function hashSha256(data: string | Uint8Array): Promise<string> {
	const hash = createHash("sha256");
	hash.update(data);
	return hash.digest("hex");
}
