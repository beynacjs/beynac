import type { Headers } from "../contracts/Headers";

// Utility functions for extracting URL information from request headers.
// Based on the original-url library, see ACKNOWLEDGEMENTS.md

function getFirstHeaderValue(headers: Headers, name: string): string | null {
	const value = headers.get(name);
	if (value === null) {
		return null;
	}
	// Handle comma-separated values (e.g., "value1, value2")
	const firstValue = value.split(",")[0];
	return firstValue?.trim() ?? null;
}

/**
 * Extract protocol from proxy headers.
 * Checks X-Forwarded-Proto, X-Forwarded-Protocol, X-Url-Scheme, Front-End-Https, and X-Forwarded-Ssl.
 *
 * @returns Protocol with colon (e.g., 'https:') or null if no proxy headers present
 */
export function getProtocolFromHeaders(headers: Headers): string | null {
	const forwardedProto = getFirstHeaderValue(headers, "x-forwarded-proto");
	if (forwardedProto) {
		return forwardedProto.includes(":") ? forwardedProto : `${forwardedProto}:`;
	}

	const forwardedProtocol = getFirstHeaderValue(headers, "x-forwarded-protocol");
	if (forwardedProtocol) {
		return forwardedProtocol.includes(":") ? forwardedProtocol : `${forwardedProtocol}:`;
	}

	const urlScheme = getFirstHeaderValue(headers, "x-url-scheme");
	if (urlScheme) {
		return urlScheme.includes(":") ? urlScheme : `${urlScheme}:`;
	}

	const frontEndHttps = getFirstHeaderValue(headers, "front-end-https");
	if (frontEndHttps === "on") {
		return "https:";
	}

	const forwardedSsl = getFirstHeaderValue(headers, "x-forwarded-ssl");
	if (forwardedSsl === "on") {
		return "https:";
	}

	return null;
}

/**
 * Parse a host string into hostname and port components.
 * Handles IPv6 addresses, port numbers, and strips protocol/path if present.
 *
 * @param hostString - Host string (e.g., "example.com:8080", "[::1]:3000")
 * @returns Object with hostname and port (port is null if not specified)
 */
export function parseHostString(hostString: string): {
	hostname: string;
	port: string | null;
} {
	// Handle IPv6 addresses wrapped in brackets
	if (hostString.startsWith("[")) {
		const bracketEnd = hostString.indexOf("]");
		if (bracketEnd !== -1) {
			const hostname = hostString.substring(0, bracketEnd + 1);
			const remainder = hostString.substring(bracketEnd + 1);
			// Check for port after IPv6 address
			const portMatch = remainder.match(/^:(\d+)/);
			return {
				hostname,
				port: portMatch?.[1] ?? null,
			};
		}
	}

	// Handle regular hostnames (may include protocol prefix)
	// Remove protocol prefix if present (e.g., "https://example.com")
	let cleaned = hostString.replace(/^https?:\/\//, "");

	// Remove path, query, and hash if present
	cleaned = cleaned.split("/")[0] ?? cleaned;
	cleaned = cleaned.split("?")[0] ?? cleaned;
	cleaned = cleaned.split("#")[0] ?? cleaned;

	// Split on the last colon to separate hostname and port
	const lastColon = cleaned.lastIndexOf(":");
	if (lastColon !== -1) {
		const potentialPort = cleaned.substring(lastColon + 1);
		// Verify it's actually a port number
		if (/^\d+$/.test(potentialPort)) {
			return {
				hostname: cleaned.substring(0, lastColon),
				port: potentialPort,
			};
		}
	}

	return {
		hostname: cleaned,
		port: null,
	};
}

/**
 * Extract hostname and port from request headers.
 * Checks X-Forwarded-Host, Host, and X-Forwarded-Port headers.
 *
 * @returns Object with hostname and port (both can be null if headers not present)
 */
export function getHostAndPortFromHeaders(headers: Headers): {
	hostname: string | null;
	port: string | null;
} {
	// Try x-forwarded-port first for port
	const forwardedPort = getFirstHeaderValue(headers, "x-forwarded-port");

	// Try x-forwarded-host
	const forwardedHost = getFirstHeaderValue(headers, "x-forwarded-host");
	if (forwardedHost) {
		const parsed = parseHostString(forwardedHost);
		return {
			hostname: parsed.hostname,
			port: forwardedPort ?? parsed.port,
		};
	}

	// Try Host header
	const host = getFirstHeaderValue(headers, "host");
	if (host) {
		const parsed = parseHostString(host);
		return {
			hostname: parsed.hostname,
			port: forwardedPort ?? parsed.port,
		};
	}

	// No host information available
	return {
		hostname: null,
		port: forwardedPort,
	};
}
