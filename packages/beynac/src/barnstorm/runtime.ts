import { describeType } from "@/utils";
import type { Component, JSX } from "./public-types";

type JSXFactory = (
	tag: string | Component,
	props: Record<string, unknown> | null,
) => JSX.Element;

export const jsx: JSXFactory = (
	tag: string | Component,
	props: Record<string, unknown> | null,
): JSX.Element => new JSXElement(tag, props);
export const jsxs: JSXFactory = jsx;
export const jsxDEV: JSXFactory = jsx;

class JSXElement {
	constructor(
		public tag: string | Component,
		public props: Record<string, unknown> | null,
	) {}

	render(): string | Promise<string> {
		const acc = { result: "" };
		renderAcc(this, acc);
		return acc.result;
	}

	renderChunks(): AsyncGenerator<string, void, void> {
		throw new Error("not implemented");
	}
}

export function render(node: JSXElement): string {
	const acc = { result: "" };
	renderAcc(node, acc);
	return acc.result;
}

export function renderAcc(element: JSXElement, acc: { result: string }): void {
	const { tag, props } = element;
	if (typeof tag === "function") {
		// component, type is function, props are attributes
		const componentResult = tag(props ?? {});
		if (componentResult != null) {
			if (componentResult instanceof JSXElement) {
				renderAcc(componentResult, acc);
			} else {
				// TODO error: component did not return JSX
			}
		} else if (componentResult === undefined) {
			// TODO error: component did not return a value. Return null to
			// explicitly render nothing.
		}
		return;
	} else if (typeof tag === "string") {
		// intrinsic element, type is tag name, props are attributes:
		//     <div attr="value">optional children</div>
		acc.result += `<${tag}`;

		let children: unknown;

		if (props != null) {
			const keys = Object.keys(props);
			for (let i = 0; i < keys.length; i++) {
				const key = keys[i];
				const value = props[key];
				if (key === "children") {
					children = value;
					continue;
				}
				if (booleanAttributes.has(key)) {
					if (value === true) {
						acc.result += ` ${key}`;
						continue;
					} else if (value === false) {
						continue;
					}
				}
				if (value == null) {
					continue;
				}
				acc.result += " ";
				acc.result += key;
				acc.result += '="';
				acc.result += escapeHtml(String(value));
				acc.result += '"';
			}
		}

		acc.result += ">";

		if (emptyTags.has(tag)) {
			// TODO error on children
			return;
		}

		if (children != null) {
			renderChildrenAcc(children, acc);
		}
		acc.result += "</";
		acc.result += tag;
		acc.result += ">";
		return;
	}
	throw new Error(
		`Expected JSX element type to be a string or function, received ${describeType(tag)}`,
	);
}

const renderChildrenAcc = (children: unknown, acc: { result: string }) => {
	if (children instanceof JSXElement) {
		renderAcc(children, acc);
	} else if (Array.isArray(children)) {
		for (const child of children) {
			renderChildrenAcc(child, acc);
		}
	} else if (typeof children !== "boolean" && children !== null) {
		acc.result += children;
	}
};

const emptyTags = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"keygen",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

const booleanAttributes = new Set([
	"allowfullscreen",
	"async",
	"autofocus",
	"autoplay",
	"checked",
	"controls",
	"default",
	"defer",
	"disabled",
	"download",
	"formnovalidate",
	"hidden",
	"inert",
	"ismap",
	"itemscope",
	"loop",
	"multiple",
	"muted",
	"nomodule",
	"novalidate",
	"open",
	"playsinline",
	"readonly",
	"required",
	"reversed",
	"selected",
]);

const HTML_ESCAPE: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
};

const escapeHtml = (str: string) =>
	str.replace(/[&<>"]/g, (ch) => HTML_ESCAPE[ch]);
