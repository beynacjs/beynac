import { compileMultiReplace, multiReplace, Replacer } from "./misc";
import { unicodeReplacements } from "./replacements"; /**
 * Remove unicode combining marks and ligatures from a string.
 *
 * This function handles accents and diacritics, but - unlike transliterate() -
 * does not go as far as language-aware replacements converting German ß to ss
 *
 * @param value - String to process
 * @param options.allowLatin1 - If true, preserve ISO-8859-1 characters like é
 *
 * @example
 * withoutMarks('Crème Brûlée') // 'Creme Brulee'
 * withoutMarks('café') // 'cafe'
 * withoutMarks('café', { allowLatin1: true }) // 'café' (é preserved as Latin1)
 */
export function withoutMarks(value: string, options?: { allowLatin1?: boolean }): string {
	if (!options?.allowLatin1) {
		return value.normalize("NFKD").replace(/\p{M}/gu, "");
	}

	// Preserve ISO-8859-1 characters, decompose only non-Latin1 sequences
	const result = value.normalize("NFC");
	return result
		.replace(/[^\x20-\x7e\xa0-\xff]+/gu, (match) => {
			// Only decompose non-Latin1 sequences
			return match.normalize("NFKD").replace(/\p{M}/gu, "");
		})
		.normalize("NFC"); // Re-compose (mainly for Hangul)
}

/**
 * Transliterate Unicode characters to their ASCII equivalents
 *
 * Use this when you need to convert text to the most sane representation that can be expressed in ASCII
 *
 * @param value - String to transliterate
 * @param options.allowLatin1 - If true, preserve ISO-8859-1 characters like é
 * @returns Transliterated string with multi-character ASCII replacements and marks removed
 *
 * @example
 * transliterate('Größe') // 'Groesse' (ß→ss, ö→oe, then marks removed)
 * transliterate('æther') // 'aether' (æ→ae)
 * transliterate('💯') // '100'
 * transliterate('€50') // 'E50'
 * transliterate('подъезд') // 'podyezd' (Cyrillic→Latin)
 * transliterate('café') // 'cafe' (é→e)
 * transliterate('café', { allowLatin1: true }) // 'café' (é preserved as Latin1)
 */
export function transliterate(value: string, options?: { allowLatin1?: boolean }): string {
	unicodeReplacer ??= compileMultiReplace(unicodeReplacements);
	let result = unicodeReplacer(value);
	result = result.replaceAll(/\p{Dash_Punctuation}/gu, "-");
	result = withoutMarks(result, options);
	return result;
}
let unicodeReplacer: Replacer | undefined;

/**
 * Remove or replace non-ASCII characters from a string.
 *
 * See transliterate or withoutMarks if you'd instead like to replace unicode
 * characters with ASCII equivalents
 *
 * @param value - String to process
 * @param options.allowLatin1 - If true, preserve ISO-8859-1 characters (0xA0-0xFF like é, ñ, ü)
 * @param options.replacement - String to replace invalid characters with (default: "")
 * @returns String with non-ASCII characters removed or replaced
 *
 * @example
 * withoutUnicode('café') // 'caf' (é removed)
 * withoutUnicode('café', { allowLatin1: true }) // 'café' (é preserved)
 * withoutUnicode('北京', { replacement: '?' }) // '??' (CJK replaced)
 */
export function withoutUnicode(
	value: string,
	options?: {
		allowLatin1?: boolean;
		replacement?: string;
	},
): string {
	const { allowLatin1 = false, replacement = "" } = options || {};

	const pattern = allowLatin1
		? /[^\x20-\x7e\xa0-\xff]/g // Keep ASCII printable + Latin1 extended
		: /[^\x20-\x7e]/g; // Keep only ASCII printable

	return value.replace(pattern, replacement);
}

export interface SlugOptions {
	/** Character to use as word separator (default: '-' */
	separator?: string;

	/**
	 * Character replacements (default: { '@': 'at', '&': 'and', '%': 'percent', '+': 'plus' })
	 * - Record<string, string>: Custom replacements (replaces default entirely)
	 * - true: Use default dictionary
	 * - false: Disable replacements
	 */
	replacements?: Record<string, string> | boolean;

	/** Convert to lowercase (default: true) */
	lowercase?: boolean;
}

/**
 * Generate a URL-friendly slug from a string
 *
 * Applies Unicode normalisation (transliterate → withoutMarks → withoutUnicode) to convert
 * all characters to ASCII, then creates a URL-safe slug with only unreserved characters.
 *
 * @param title - String to convert to slug
 * @param options.separator - Separator character (default: "-")
 * @param options.replacements - Character replacements (default: { '@': 'at', '&': 'and', '%': 'percent', '+': 'plus' })
 *   - Record<string, string>: Custom replacements (replaces default entirely)
 *   - true: Use default dictionary
 *   - false: Disable replacements
 * @param options.lowercase - Convert to lowercase (default: true)
 *
 * @example
 * slug('Größe café') // 'groesse-cafe'
 * slug('hello  world') // 'hello-world'
 * slug('email@example') // 'email-at-example'
 * slug('Tom & Jerry') // 'tom-and-jerry'
 * slug('100%') // '100-percent'
 * slug('hello world', { separator: '_' }) // 'hello_world'
 * slug('100%', { replacements: { '%': 'pct' } }) // '100-pct'
 * slug('café!', { replacements: false }) // 'cafe' (! removed, no replacements)
 * slug('Hello', { lowercase: false }) // 'Hello'
 */
export function slug(title: string, options: SlugOptions = {}): string {
	const { separator = "-", replacements = true, lowercase = true } = options;

	let result = title;

	if (replacements !== false) {
		result = multiReplace(
			result,
			replacements === true ? { "@": "at", "&": "and", "%": "percent", "+": "plus" } : replacements,
		);
	}

	result = transliterate(title);
	result = withoutUnicode(result);
	if (lowercase) {
		result = result.toLowerCase();
	}

	// Remove quotes & apostrophes which typically appear within words and shouldn't create word breaks
	result = result.replace(/['`´]/g, "");

	// Replace inter-word marks with space, these typically separate words/phrases
	result = result.replace(/[—–;/\\|:]/g, " ");

	// Keep only unreserved URL characters: A-Z a-z 0-9 - _ . ~ and whitespace
	// RFC 3986: unreserved = ALPHA / DIGIT / "-" / "." / "_" / "~"
	result = result.replace(/[^a-z0-9\-_.~\s]/gi, "");

	result = result.trim().replace(/\s+/g, separator);

	return result;
}
