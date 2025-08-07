import type { HtmlEscapedString } from "../utils/html";
import type { Child } from "./";

/**
 * Helper function to convert children to string array for SSR.
 * Handles async components by awaiting promises.
 */
export const childrenToString = async (
	children: Child[],
): Promise<HtmlEscapedString[]> => {
	try {
		return children
			.flat()
			.map((c) =>
				c == null || typeof c === "boolean" ? "" : c.toString(),
			) as HtmlEscapedString[];
	} catch (e) {
		if (e instanceof Promise) {
			await e;
			return childrenToString(children);
		} else {
			throw e;
		}
	}
};
