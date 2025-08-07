/**
 * @module
 * This module provides Hono's JSX dev runtime.
 */

import type { HtmlEscapedString } from "../utils/html";
import type { JSXNode } from "./base";
import { jsxFn } from "./base";

export type { JSX } from "./base";
export { Fragment } from "./base";

export function jsxDEV(
	// biome-ignore lint/complexity/noBannedTypes: vendored code
	tag: string | Function,
	props: Record<string, unknown>,
	key?: string,
): JSXNode {
	let node: JSXNode;
	if (!props || !("children" in props)) {
		node = jsxFn(tag, props, []);
	} else {
		const children = props.children as string | HtmlEscapedString;
		node = Array.isArray(children)
			? jsxFn(tag, props, children)
			: jsxFn(tag, props, [children]);
	}
	node.key = key;
	return node;
}
