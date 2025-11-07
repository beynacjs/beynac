import { keyValueReplacer, Replacer } from "./misc";
import { unicodeReplacements } from "./replacements";

/**
 * Remove unicode combining marks and ligatures from a string
 *
 * @param value - String to process
 * @returns String with combining marks removed
 *
 * @example
 * withoutMarks('Crème Brûlée') // 'Creme Brulee'
 * withoutMarks('café') // 'cafe'
 * withoutMarks('ﬁle') // 'file' (ligature decomposed)
 * withoutMarks('का') // 'क' (Devanagari vowel sign removed)
 */
export function withoutMarks(value: string): string {
	// NFKD normalization decomposes characters (including ligatures)
	// and separates base characters from combining marks
	return value.normalize("NFKD").replace(/\p{M}/gu, "");
}

/**
 * Transliterate Unicode characters to their ASCII equivalents using a built-in database of multi-character expansions
 *
 * @param value - String to transliterate
 * @returns Transliterated string with multi-character ASCII replacements
 *
 * @example
 * transliterate('Größe') // 'Groesse' (ß→ss, ö→oe)
 * transliterate('æther') // 'aether'
 * transliterate('💯') // '100'
 * transliterate('€50') // 'E50'
 * transliterate('подъезд') // 'podyezd' (multi-character sequence ъе→ye)
 */
export function transliterate(value: string): string {
	unicodeReplacer ??= keyValueReplacer(unicodeReplacements);
	let result = unicodeReplacer(value);
	// Normalize all Unicode dash punctuation (en-dash, em-dash, etc.) to regular hyphens
	result = result.replaceAll(/\p{Dash_Punctuation}/gu, "-");
	return result;
}
let unicodeReplacer: Replacer | undefined;

export interface SlugOptions {
	/** Character to use as word separator (default: '-' */
	separator?: string;

	/**
	 * Character replacements (default: { '@': 'at', '&': 'and', '%': 'percent' })
	 * - Record<string, string>: Custom replacements (replaces default entirely)
	 * - true: Use default dictionary
	 * - false: Disable replacements
	 */
	replacements?: Record<string, string> | boolean;

	/** Convert to lowercase (default: true) */
	lowercase?: boolean;

	/** Apply unicode transliteration (default: true) */
	transliterate?: boolean;

	/** Remove unicode combining marks (default: true) */
	withoutMarks?: boolean;

	/**
	 * Which characters to keep (default: 'urlsafe')
	 * - 'urlsafe': Keep only unreserved URL characters (A-Z, a-z, 0-9, -, _, ., ~)
	 * - 'ascii': Keep all ASCII characters (0x00-0x7F) including ! * ( ) etc
	 * - 'all': Keep all characters including non-ASCII Unicode
	 */
	keep?: "urlsafe" | "ascii" | "all";
}

/**
 * Generate a URL-friendly slug from a string
 *
 * @param title - String to convert to slug
 * @param options.separator - Separator character (default: "-")
 * @param options.replacements - Replace the default character replacements (default: { '@': 'at', '&': 'and', '%': 'percent', '+': 'plus' })
 * Note: Setting this replaces the default replacements entirely.
 * Include '@', '&', and '%' if you want to keep them.
 * @param options.lowercase - Convert to lowercase (default: true)
 * @param options.transliterate (default true) - apply `str.transliterate()` to convert e.g. 'ß' to 'ss'. If false, the special characters will be omitted or kept depending on the `keep` option.
 * @param options.withoutMarks (default true) - apply `str.withoutMarks()` to convert e.g. 'ä' to 'a'. If false, the special characters will be omitted or kept depending on the `keep` option.
 * @param options.keep (default 'urlsafe') - Which characters to keep in the slug. 'urlsafe' keeps only unreserved URL characters (A-Z, a-z, 0-9, -, _, ., ~), 'ascii' keeps all ASCII characters including ! * ( ), 'all' keeps everything including non-ASCII Unicode.
 *
 * @example
 * slug('Größe café') // 'groesse-cafe'
 * slug('hello  world') // 'hello-world'
 * slug('email@example') // 'email-at-example'
 * slug('Tom & Jerry') // 'tom-and-jerry'
 * slug('100%') // '100-percent'
 * slug('hello world', { separator: '_' }) // 'hello_world'
 * slug('100%', { replacements: { '%': 'pct' } }) // '100-pct'
 * slug('Größe', { transliterate: false }) // 'groe' (withoutMarks decomposes ö→o, ß removed by keep:'urlsafe')
 * slug('Größe', { transliterate: false, keep: 'all' }) // 'große' (withoutMarks decomposes ö→o, keeps ß)
 * slug('Größe', { withoutMarks: false }) // 'groesse' (transliterate converts ö→oe and ß→ss)
 * slug('café!', { keep: 'urlsafe' }) // 'cafe' (! is not URL-safe, removed)
 * slug('café!', { keep: 'ascii', replacements: false }) // 'cafe!' (! is ASCII, kept)
 * slug('café!', { keep: 'all', transliterate: false, withoutMarks: false }) // 'café!' (everything kept)
 * slug('Hello', { lowercase: false }) // 'Hello'
 */
export function slug(title: string, options: SlugOptions = {}): string {
	const {
		separator = "-",
		replacements = true,
		lowercase = true,
		transliterate: shouldTransliterate = true,
		withoutMarks: shouldRemoveMarks = true,
		keep = "urlsafe",
	} = options;

	let result = title;

	if (shouldTransliterate) {
		result = transliterate(result);
	}

	if (shouldRemoveMarks) {
		result = withoutMarks(result);
	}

	const replacementsDict =
		replacements === false
			? {}
			: replacements === true
				? { "@": "at", "&": "and", "%": "percent", "+": "plus" }
				: replacements;

	for (const [key, value] of Object.entries(replacementsDict)) {
		result = result.replaceAll(key, ` ${value} `);
	}

	// Step 4: Convert to lowercase
	if (lowercase) {
		result = result.toLowerCase();
	}

	// Remove quotes & apostrophes which typically appear within words and shouldn't create word breaks
	result = result.replace(/['`´]/g, "");

	// Replace inter-word marks with space, these typically separate words/phrases
	result = result.replace(/[—–;/\\|:]/g, " ");

	// Keep only allowed characters based on mode
	if (keep === "urlsafe") {
		// Keep only unreserved URL characters: A-Z a-z 0-9 - _ . ~ and whitespace
		// RFC 3986: unreserved = ALPHA / DIGIT / "-" / "." / "_" / "~"
		result = result.replace(/[^a-z0-9\-_.~\s]/gi, "");
	} else if (keep === "ascii") {
		// Keep all ASCII characters (0x00-0x7F) and whitespace
		// Preserves URL reserved characters like ! * ' ( ) ; : @ & = + $ , / ? # [ ]
		result = result.replace(/[^\x00-\x7F]/g, "");
	}
	// else keep === 'all': keep everything

	result = result.trim().replace(/\s+/g, separator);

	return result;
}
