import { regExpEscape } from "../../utils";

export type Replacer = (input: string) => string;

/**
 * Create a function that efficiently replaces keys with their corresponding values in a string.
 *
 * Compiles the keys into a regular expression, which for large dictionaries is more efficient than using multiple replace calls.
 *
 * @example
 * const replacer = keyValueReplacer({ a: "1", b: "2" });
 * console.log(replacer("a + b")); // Output: "1 + 2"
 */
export const keyValueReplacer = (replacements: Record<string, string>): Replacer => {
	const keys = Object.keys(replacements);
	// Sort by length descending to match longer keys first (e.g., "ъе" before "ъ")
	keys.sort((a, b) => b.length - a.length);
	const escapedKeys = keys.map((key) => regExpEscape(key));
	const keyRegex = new RegExp(escapedKeys.join("|"), "g");
	return (str: string) => str.replace(keyRegex, (match) => replacements[match] ?? "");
};
