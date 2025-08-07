import { raw } from "../helper/html";
import type { HtmlEscapedString } from "../utils/html";
import type { Child, FC, PropsWithChildren } from "./";

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

export type ErrorHandler = (error: Error) => void;
export type FallbackRender = (error: Error) => Child;

/**
 * @experimental
 * `ErrorBoundary` is an experimental feature.
 * The API might be changed.
 */
export const ErrorBoundary: FC<
	PropsWithChildren<{
		fallback?: Child;
		fallbackRender?: FallbackRender;
		onError?: ErrorHandler;
	}>
> = async ({ children, fallback, fallbackRender, onError }) => {
	if (!children) {
		return raw("");
	}

	if (!Array.isArray(children)) {
		children = [children];
	}

	try {
		const resArray = await childrenToString(children);
		return raw(resArray.join(""));
	} catch (error) {
		onError?.(error as Error);
		const fallbackContent = fallbackRender?.(error as Error) || fallback || "";
		return raw(fallbackContent.toString());
	}
};
