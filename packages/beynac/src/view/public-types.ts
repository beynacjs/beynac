import type { Key } from "../keys";
import type * as CSS from "../vendor/csstype";
import type { IntrinsicElements as IntrinsicElementsDefined } from "./intrinsic-element-types";

export type RenderOptions = {
	mode?: "html" | "xml" | undefined;
	context?: Context | undefined;
};

export interface Context {
	get<T>(key: Key<T>): T | null;
	set<T>(key: Key<T>, value: T): void;
}

export type JSXNode =
	| string
	| number
	| bigint
	| boolean
	| JSXNode[]
	| object
	| null
	| undefined
	| ((context: Context) => JSXNode | Promise<JSXNode>);

export const JSXElementBrand: unique symbol = Symbol.for("beynac.jsx.element");

export interface JSXElement {
	readonly [JSXElementBrand]: true;
}

export function tagAsJsxElement<T>(value: T): T & JSXElement {
	// oxlint-disable-next-line no-explicit-any -- setting runtime brand on arbitrary value
	(value as any)[JSXElementBrand] = true;
	return value as T & JSXElement;
}

export function isJsxElement(value: unknown): value is JSXElement {
	return value != null && typeof value === "object" && JSXElementBrand in value;
}

export namespace JSX {
	export type Element = JSXElement | Promise<JSXElement | null> | null;

	export type Children = JSXNode;

	export interface ElementChildrenAttribute {
		children: Children;
	}

	export interface IntrinsicElements extends IntrinsicElementsDefined {
		[tagName: string]: Props;
	}

	export interface IntrinsicAttributes {}

	export interface ElementAttributesProperty {
		props: {};
	}

	export interface ElementClass {
		render(context: Context): Element;
	}
}

// oxlint-disable-next-line no-explicit-any -- we follow react in using any here
export type Props = Record<string, any>;

export type PropsWithChildren<P = unknown> = P & {
	children?: JSX.Children | undefined;
};

export type CSSProperties = CSS.Properties<(string & {}) | number> & {
	[key: `--${string}`]: string | number;
};
