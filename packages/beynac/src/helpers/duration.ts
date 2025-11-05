/**
 * Parse a duration string into milliseconds
 *
 * Supports duration strings with units:
 * - y (year)
 * - w (week)
 * - d (day)
 * - h (hour)
 * - m (minute)
 * - s (second)
 * - ms (millisecond)
 *
 * Combined formats like "5d4h" or "1h30m15s" are supported.
 *
 * @param duration - Duration string (e.g., "1h", "5d4h", "1h30m15s")
 * @returns Number of milliseconds
 * @throws Error if format is invalid or duration is negative/zero
 *
 * @example
 * parseDurationAsMs("1h") // 3600000
 * parseDurationAsMs("5d4h") // 446400000
 * parseDurationAsMs("1h30m15s") // 5415000
 */
export function parseDurationAsMs(duration: string): number {
	// Parse duration string
	const pattern = /^(\d+y)?(\d+w)?(\d+d)?(\d+h)?(\d+m)?(\d+s)?(\d+ms)?$/;
	const match = duration.match(pattern);

	if (!match) {
		throw new Error(
			`Invalid duration format: "${duration}". Expected format like "1h", "5d4h", "1h30m15s"`,
		);
	}

	// Extract components
	const years = match[1] ? parseInt(match[1]) : 0;
	const weeks = match[2] ? parseInt(match[2]) : 0;
	const days = match[3] ? parseInt(match[3]) : 0;
	const hours = match[4] ? parseInt(match[4]) : 0;
	const minutes = match[5] ? parseInt(match[5]) : 0;
	const seconds = match[6] ? parseInt(match[6]) : 0;
	const milliseconds = match[7] ? parseInt(match[7]) : 0;

	// Calculate total milliseconds
	let totalMs = 0;
	totalMs += years * 365 * 24 * 60 * 60 * 1000;
	totalMs += weeks * 7 * 24 * 60 * 60 * 1000;
	totalMs += days * 24 * 60 * 60 * 1000;
	totalMs += hours * 60 * 60 * 1000;
	totalMs += minutes * 60 * 1000;
	totalMs += seconds * 1000;
	totalMs += milliseconds;

	if (totalMs < 0) {
		throw new Error(`Negative duration not allowed: "${duration}"`);
	}

	if (totalMs === 0) {
		throw new Error(`Duration must be greater than zero: "${duration}"`);
	}

	return totalMs;
}

/**
 * Parse a duration string or Date object into a future Date
 *
 * If a Date object is provided, it is returned unchanged.
 * If a string is provided, it is parsed as a duration and added to the current time.
 *
 * @param duration - Duration string (e.g., "1h", "5d4h") or Date object
 * @returns Date object representing the expiration time
 * @throws Error if format is invalid or duration is negative/zero
 *
 * @example
 * parseDurationAsFutureDate("1h") // Date 1 hour from now
 * parseDurationAsFutureDate(new Date("2025-12-31")) // Date("2025-12-31")
 */
export function parseDurationAsFutureDate(duration: string | Date): Date {
	// If already a Date, return it
	if (duration instanceof Date) {
		return duration;
	}

	const ms = parseDurationAsMs(duration);
	return new Date(Date.now() + ms);
}
