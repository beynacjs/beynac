/**
 * All types exported from "hono/jsx" are in this file.
 */
import type { Child, JSXNode } from "./base";
import type { JSX } from "./intrinsic-elements";

export type { Child, FC, JSXNode } from "./base";
export type { Context } from "./context";

export type PropsWithChildren<P = unknown> = P & {
	children?: Child | undefined;
};
export type CSSProperties = JSX.CSSProperties;

/**
 * React types
 */

// biome-ignore lint/suspicious/noExplicitAny: vendored code
// biome-ignore lint/complexity/noBannedTypes: vendored code
type ReactElement<P = any, T = string | Function> = JSXNode & {
	type: T;
	props: P;
	key: string | null;
};
type ReactNode = ReactElement | string | number | boolean | null | undefined;

// biome-ignore lint/complexity/noBannedTypes: vendored code
type ComponentClass<_P = {}, _S = {}> = unknown;

export type { ReactElement, ReactNode, ComponentClass };
