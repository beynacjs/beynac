/*!
 * This file imported from content-disposition package
 * Original Copyright(c) 2014-2017 Douglas Christopher Wilson
 * MIT Licensed
 *
 * It has been modified from the original
 */

import { basename } from "node:path";

/**
 * Options for contentDisposition function
 */
export interface ContentDispositionOptions {
	/**
	 * The disposition type (default: 'attachment')
	 */
	type?: string;
	/**
	 * Fallback filename for non-UTF-8 browsers
	 * - true (default): auto-generate ISO-8859-1 fallback
	 * - false: no fallback
	 * - string: custom ISO-8859-1 fallback
	 */
	fallback?: string | boolean;
}

/**
 * Parsed header with value and attributes
 */
export interface ParsedHeader {
	/**
	 * The header value (e.g., 'attachment', 'inline')
	 */
	value: string;
	/**
	 * Attributes from the header
	 */
	attributes: Record<string, string>;
}

/**
 * Create an attachment Content-Disposition header.
 *
 * @param {string} [filename]
 * @param {ContentDispositionOptions} [options]
 * @return {string}
 * @public
 */
export function contentDisposition(filename?: string, options?: ContentDispositionOptions): string {
	const opts = options || {};

	// get type
	const type = opts.type || "attachment";

	// get parameters
	const params = createparams(filename, opts.fallback);

	// format into string
	return format({ value: type, attributes: params || {} });
}

/**
 * Format attribute header with value and attributes.
 *
 * @param {object} options
 * @param {string} options.value - Header value (e.g., 'attachment', 'inline')
 * @param {Record<string, string | number>} [options.attributes] - Attributes to include
 * @param {Record<string, string | boolean>} [options.fallbacks] - Fallback values for attributes
 * @return {string}
 * @public
 */
export function formatAttributeHeader(options: {
	value: string;
	attributes?: Record<string, string | number>;
	fallbacks?: Record<string, string | boolean>;
}): string {
	const { value, attributes = {}, fallbacks = {} } = options;
	const params = buildAttributesWithFallbacks(attributes, fallbacks);
	return format({ value, attributes: params });
}

/**
 * Format Content-Disposition header.
 *
 * @param {object} options
 * @param {string} options.filename - Filename for the attachment
 * @param {string | boolean} [options.fallback=true] - Fallback handling
 * @param {string} [options.type='attachment'] - Disposition type
 * @return {string}
 * @public
 */
export function formatContentDispositionHeader(options: {
	filename: string;
	fallback?: string | boolean;
	type?: string;
}): string {
	const { filename, fallback = true, type = "attachment" } = options;
	return formatAttributeHeader({
		value: type,
		attributes: { filename },
		fallbacks: { filename: fallback },
	});
}

/**
 * Parse attribute header string.
 *
 * @param {string} string
 * @return {ParsedHeader}
 * @public
 */
export function parseAttributeHeader(string: string): ParsedHeader {
	if (!string || typeof string !== "string") {
		throw new TypeError("argument string is required");
	}

	const match = DISPOSITION_TYPE_REGEXP.exec(string);

	if (!match) {
		throw new TypeError("invalid type format");
	}

	// normalize type
	let index = match[0].length;
	const headerValue = match[1].toLowerCase();

	let key: string;
	const names: string[] = [];
	const attributes: Record<string, string> = {};
	let value: string;

	// calculate index to start at
	index = PARAM_REGEXP.lastIndex = match[0].slice(-1) === ";" ? index - 1 : index;

	// match parameters
	let paramMatch: RegExpExecArray | null;
	while ((paramMatch = PARAM_REGEXP.exec(string))) {
		if (paramMatch.index !== index) {
			throw new TypeError("invalid parameter format");
		}

		index += paramMatch[0].length;
		key = paramMatch[1].toLowerCase();
		value = paramMatch[2];

		if (names.indexOf(key) !== -1) {
			throw new TypeError("invalid duplicate parameter");
		}

		names.push(key);

		if (key.indexOf("*") + 1 === key.length) {
			// decode extended value
			key = key.slice(0, -1);
			value = decodefield(value);

			// overwrite existing value
			attributes[key] = value;
			continue;
		}

		if (typeof attributes[key] === "string") {
			continue;
		}

		if (value[0] === '"') {
			// remove quotes and escapes
			value = value.slice(1, -1).replace(QESC_REGEXP, "$1");
		}

		attributes[key] = value;
	}

	if (index !== -1 && index !== string.length) {
		throw new TypeError("invalid parameter format");
	}

	return { value: headerValue, attributes };
}

//
// IMPLEMENTATION
//

/**
 * RegExp to match non attr-char, *after* encodeURIComponent (i.e. not including "%")
 * @private
 */
const ENCODE_URL_ATTR_CHAR_REGEXP = /[\x00-\x20"'()*,/:;<=>?@[\\\]{}\x7f]/g;

/**
 * RegExp to match percent encoding escape.
 * @private
 */
const HEX_ESCAPE_REGEXP = /%[0-9A-Fa-f]{2}/;
const HEX_ESCAPE_REPLACE_REGEXP = /%([0-9A-Fa-f]{2})/g;

/**
 * RegExp to match non-latin1 characters.
 * @private
 */
const NON_LATIN1_REGEXP = /[^\x20-\x7e\xa0-\xff]/g;

/**
 * RegExp to match quoted-pair in RFC 2616
 *
 * quoted-pair = "\" CHAR
 * CHAR        = <any US-ASCII character (octets 0 - 127)>
 * @private
 */
const QESC_REGEXP = /\\([\u0000-\u007f])/g;

/**
 * RegExp to match chars that must be quoted-pair in RFC 2616
 * @private
 */
const QUOTE_REGEXP = /([\\"])/g;

/**
 * RegExp for various RFC 2616 grammar
 *
 * parameter     = token "=" ( token | quoted-string )
 * token         = 1*<any CHAR except CTLs or separators>
 * separators    = "(" | ")" | "<" | ">" | "@"
 *               | "," | ";" | ":" | "\" | <">
 *               | "/" | "[" | "]" | "?" | "="
 *               | "{" | "}" | SP | HT
 * quoted-string = ( <"> *(qdtext | quoted-pair ) <"> )
 * qdtext        = <any TEXT except <">>
 * quoted-pair   = "\" CHAR
 * CHAR          = <any US-ASCII character (octets 0 - 127)>
 * TEXT          = <any OCTET except CTLs, but including LWS>
 * LWS           = [CRLF] 1*( SP | HT )
 * CRLF          = CR LF
 * CR            = <US-ASCII CR, carriage return (13)>
 * LF            = <US-ASCII LF, linefeed (10)>
 * SP            = <US-ASCII SP, space (32)>
 * HT            = <US-ASCII HT, horizontal-tab (9)>
 * CTL           = <any US-ASCII control character (octets 0 - 31) and DEL (127)>
 * OCTET         = <any 8-bit sequence of data>
 * @private
 */
const PARAM_REGEXP =
	/;[\x09\x20]*([!#$%&'*+.0-9A-Z^_`a-z|~-]+)[\x09\x20]*=[\x09\x20]*("(?:[\x20!\x23-\x5b\x5d-\x7e\x80-\xff]|\\[\x20-\x7e])*"|[!#$%&'*+.0-9A-Z^_`a-z|~-]+)[\x09\x20]*/g;
const TEXT_REGEXP = /^[\x20-\x7e\x80-\xff]+$/;
const TOKEN_REGEXP = /^[!#$%&'*+.0-9A-Z^_`a-z|~-]+$/;

/**
 * RegExp for various RFC 5987 grammar
 *
 * ext-value     = charset  "'" [ language ] "'" value-chars
 * charset       = "UTF-8" / "ISO-8859-1" / mime-charset
 * mime-charset  = 1*mime-charsetc
 * mime-charsetc = ALPHA / DIGIT
 *               / "!" / "#" / "$" / "%" / "&"
 *               / "+" / "-" / "^" / "_" / "`"
 *               / "{" / "}" / "~"
 * language      = ( 2*3ALPHA [ extlang ] )
 *               / 4ALPHA
 *               / 5*8ALPHA
 * extlang       = *3( "-" 3ALPHA )
 * value-chars   = *( pct-encoded / attr-char )
 * pct-encoded   = "%" HEXDIG HEXDIG
 * attr-char     = ALPHA / DIGIT
 *               / "!" / "#" / "$" / "&" / "+" / "-" / "."
 *               / "^" / "_" / "`" / "|" / "~"
 * @private
 */
const EXT_VALUE_REGEXP =
	/^([A-Za-z0-9!#$%&+\-^_`{}~]+)'(?:[A-Za-z]{2,3}(?:-[A-Za-z]{3}){0,3}|[A-Za-z]{4,8}|)'((?:%[0-9A-Fa-f]{2}|[A-Za-z0-9!#$&+.^_`|~-])+)$/;

/**
 * RegExp for various RFC 6266 grammar
 *
 * disposition-type = "inline" | "attachment" | disp-ext-type
 * disp-ext-type    = token
 * disposition-parm = filename-parm | disp-ext-parm
 * filename-parm    = "filename" "=" value
 *                  | "filename*" "=" ext-value
 * disp-ext-parm    = token "=" value
 *                  | ext-token "=" ext-value
 * ext-token        = <the characters in token, followed by "*">
 * @private
 */
const DISPOSITION_TYPE_REGEXP = /^([!#$%&'*+.0-9A-Z^_`a-z|~-]+)[\x09\x20]*(?:$|;)/;

/**
 * Build attributes with fallbacks for multiple parameters.
 *
 * @param {Record<string, string | number>} attributes
 * @param {Record<string, string | boolean>} [fallbacks]
 * @return {Record<string, string>}
 * @private
 */
function buildAttributesWithFallbacks(
	attributes: Record<string, string | number>,
	fallbacks: Record<string, string | boolean> = {},
): Record<string, string> {
	const result: Record<string, string> = {};

	for (const [key, rawValue] of Object.entries(attributes)) {
		const value = String(rawValue);
		const fallback = fallbacks[key] !== undefined ? fallbacks[key] : true;

		// Special handling for filename attribute
		if (key === "filename") {
			const fileParams = createFilenameParams(value, fallback);
			Object.assign(result, fileParams);
			continue;
		}

		// Generic attribute handling
		if (typeof fallback !== "string" && typeof fallback !== "boolean") {
			throw new TypeError(`fallback for ${key} must be a string or boolean`);
		}

		if (typeof fallback === "string" && NON_LATIN1_REGEXP.test(fallback)) {
			throw new TypeError(`fallback for ${key} must be ISO-8859-1 string`);
		}

		// Determine if value is suitable for quoted string
		const isQuotedString = TEXT_REGEXP.test(value);

		// Generate fallback value
		const fallbackValue =
			typeof fallback !== "string" ? (fallback ? getlatin1(value) : false) : fallback;
		const hasFallback = typeof fallbackValue === "string" && fallbackValue !== value;

		// Set extended parameter if needed
		if (hasFallback || !isQuotedString || HEX_ESCAPE_REGEXP.test(value)) {
			result[key + "*"] = value;
		}

		// Set regular parameter
		if (isQuotedString || hasFallback) {
			result[key] = hasFallback ? fallbackValue : value;
		}
	}

	return result;
}

/**
 * Create parameters object from filename and fallback.
 *
 * @param {string} filename
 * @param {string|boolean} fallback
 * @return {Record<string, string>}
 * @private
 */
function createFilenameParams(
	filename: string,
	fallback: string | boolean,
): Record<string, string> {
	const params: Record<string, string> = {};

	if (typeof filename !== "string") {
		throw new TypeError("filename must be a string");
	}

	if (typeof fallback !== "string" && typeof fallback !== "boolean") {
		throw new TypeError("fallback must be a string or boolean");
	}

	if (typeof fallback === "string" && NON_LATIN1_REGEXP.test(fallback)) {
		throw new TypeError("fallback must be ISO-8859-1 string");
	}

	// restrict to file base name
	const name = basename(filename);

	// determine if name is suitable for quoted string
	const isQuotedString = TEXT_REGEXP.test(name);

	// generate fallback name
	const fallbackName =
		typeof fallback !== "string" ? (fallback ? getlatin1(name) : false) : basename(fallback);
	const hasFallback = typeof fallbackName === "string" && fallbackName !== name;

	// set extended filename parameter
	if (hasFallback || !isQuotedString || HEX_ESCAPE_REGEXP.test(name)) {
		params["filename*"] = name;
	}

	// set filename parameter
	if (isQuotedString || hasFallback) {
		params.filename = hasFallback ? fallbackName : name;
	}

	return params;
}

/**
 * Create parameters object from filename and fallback (legacy wrapper).
 *
 * @param {string} [filename]
 * @param {string|boolean} [fallback=true]
 * @return {Record<string, string>}
 * @private
 */
function createparams(
	filename: string | undefined,
	fallback: string | boolean | undefined,
): Record<string, string> | undefined {
	if (filename === undefined) {
		return;
	}

	// fallback defaults to true
	if (fallback === undefined) {
		fallback = true;
	}

	return createFilenameParams(filename, fallback);
}

/**
 * Format object to header string.
 *
 * @param {ParsedHeader} obj
 * @return {string}
 * @private
 */
function format(obj: ParsedHeader): string {
	const attributes = obj.attributes;
	const headerValue = obj.value;

	if (!headerValue || typeof headerValue !== "string" || !TOKEN_REGEXP.test(headerValue)) {
		throw new TypeError("invalid type");
	}

	// start with normalized type
	let string = String(headerValue).toLowerCase();

	// append parameters
	if (attributes && typeof attributes === "object") {
		const params = Object.keys(attributes).sort();

		for (let i = 0; i < params.length; i++) {
			const param = params[i];

			const val = param.slice(-1) === "*" ? ustring(attributes[param]) : qstring(attributes[param]);

			string += "; " + param + "=" + val;
		}
	}

	return string;
}

/**
 * Decode a RFC 5987 field value (gracefully).
 *
 * @param {string} str
 * @return {string}
 * @private
 */
function decodefield(str: string): string {
	const match = EXT_VALUE_REGEXP.exec(str);

	if (!match) {
		throw new TypeError("invalid extended field value");
	}

	const charset = match[1].toLowerCase();
	const encoded = match[2];
	let value: string;

	// to binary string
	const binary = encoded.replace(HEX_ESCAPE_REPLACE_REGEXP, pdecode);

	switch (charset) {
		case "iso-8859-1":
			value = getlatin1(binary);
			break;
		case "utf-8":
		case "utf8":
			value = Buffer.from(binary, "binary").toString("utf8").normalize("NFC");
			break;
		default:
			throw new TypeError("unsupported charset in extended field");
	}

	return value;
}

/**
 * Get ISO-8859-1 version of string.
 *
 * @param {string} val
 * @return {string}
 * @private
 */
function getlatin1(val: string): string {
	// simple Unicode -> ISO-8859-1 transformation
	return String(val).replace(NON_LATIN1_REGEXP, "?");
}

/**
 * Percent decode a single character.
 *
 * @param {string} _str
 * @param {string} hex
 * @return {string}
 * @private
 */
function pdecode(_str: string, hex: string): string {
	return String.fromCharCode(parseInt(hex, 16));
}

/**
 * Percent encode a single character.
 *
 * @param {string} char
 * @return {string}
 * @private
 */
function pencode(char: string): string {
	return "%" + String(char).charCodeAt(0).toString(16).toUpperCase();
}

/**
 * Quote a string for HTTP.
 *
 * @param {string} val
 * @return {string}
 * @private
 */
function qstring(val: string): string {
	const str = String(val);

	return '"' + str.replace(QUOTE_REGEXP, "\\$1") + '"';
}

/**
 * Encode a Unicode string for HTTP (RFC 5987).
 *
 * @param {string} val
 * @return {string}
 * @private
 */
function ustring(val: string): string {
	const str = String(val);

	// percent encode as UTF-8
	const encoded = encodeURIComponent(str).replace(ENCODE_URL_ATTR_CHAR_REGEXP, pencode);

	return "UTF-8''" + encoded;
}
