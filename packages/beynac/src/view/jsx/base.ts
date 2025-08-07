// biome-ignore-all lint/performance/noDynamicNamespaceImportAccess: vendored code

import { raw } from "../helper/html";
import type {
	HtmlEscaped,
	HtmlEscapedString,
	StringBufferWithCallbacks,
} from "../utils/html";
import {
	escapeToBuffer,
	resolveCallbackSync,
	stringBufferToString,
} from "../utils/html";
import type { Context } from "./context";
import { createContext, globalContexts, useContext } from "./context";
// Removed DOM-specific imports
import * as intrinsicElementTags from "./intrinsic-element/components";
import type {
	JSX as HonoJSX,
	IntrinsicElements as IntrinsicElementsDefined,
} from "./intrinsic-elements";
import { normalizeIntrinsicElementKey, styleObjectForEach } from "./utils";

// biome-ignore lint/suspicious/noExplicitAny: vendored code
export type Props = Record<string, any>;
export type FC<P = Props> = {
	(props: P): HtmlEscapedString | Promise<HtmlEscapedString> | null;
	defaultProps?: Partial<P> | undefined;
	displayName?: string | undefined;
};
export type DOMAttributes = HonoJSX.HTMLAttributes;

export namespace JSX {
	export type Element = HtmlEscapedString | Promise<HtmlEscapedString>;
	export interface ElementChildrenAttribute {
		children: Child;
	}
	export interface IntrinsicElements extends IntrinsicElementsDefined {
		[tagName: string]: Props;
	}
	export interface IntrinsicAttributes {
		key?: string | number | bigint | null | undefined;
	}
}

let nameSpaceContext: Context<string> | undefined;
export const getNameSpaceContext = (): Context<string> | undefined =>
	nameSpaceContext;

const toSVGAttributeName = (key: string): string =>
	/[A-Z]/.test(key) &&
	// Presentation attributes are findable in style object. "clip-path", "font-size", "stroke-width", etc.
	// Or other un-deprecated kebab-case attributes. "overline-position", "paint-order", "strikethrough-position", etc.
	key.match(
		/^(?:al|basel|clip(?:Path|Rule)$|co|do|fill|fl|fo|gl|let|lig|i|marker[EMS]|o|pai|pointe|sh|st[or]|text[^L]|tr|u|ve|w)/,
	)
		? key.replace(/([A-Z])/g, "-$1").toLowerCase()
		: key;

const emptyTags = [
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
];
const booleanAttributes = [
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
];

const childrenToStringToBuffer = (
	children: Child[],
	buffer: StringBufferWithCallbacks,
): void => {
	for (let i = 0, len = children.length; i < len; i++) {
		const child = children[i];
		if (typeof child === "string") {
			escapeToBuffer(child, buffer);
		} else if (
			typeof child === "boolean" ||
			child === null ||
			child === undefined
		) {
		} else if (child instanceof JSXNode) {
			child.toStringToBuffer(buffer);
		} else if (
			typeof child === "number" ||
			(child as unknown as { isEscaped: boolean }).isEscaped
		) {
			(buffer[0] as string) += child;
		} else if (child instanceof Promise) {
			buffer.unshift("", child);
		} else {
			// `child` type is `Child[]`, so stringify recursively
			childrenToStringToBuffer(child, buffer);
		}
	}
};

type LocalContexts = [Context<unknown>, unknown][];
export type Child =
	| string
	| Promise<string>
	| number
	| JSXNode
	| null
	| undefined
	| boolean
	| Child[];
export class JSXNode implements HtmlEscaped {
	// biome-ignore lint/complexity/noBannedTypes: vendored code
	tag: string | Function;
	props: Props;
	key?: string;
	children: Child[];
	isEscaped: true = true as const;
	localContexts?: LocalContexts;
	// biome-ignore lint/complexity/noBannedTypes: vendored code
	constructor(tag: string | Function, props: Props, children: Child[]) {
		this.tag = tag;
		this.props = props;
		this.children = children;
	}

	// biome-ignore lint/complexity/noBannedTypes: vendored code
	get type(): string | Function {
		return this.tag as string;
	}

	// Added for compatibility with libraries that rely on React's internal structure
	// biome-ignore lint/suspicious/noExplicitAny: vendored code
	get ref(): any {
		return this.props.ref || null;
	}

	toString(): string | Promise<string> {
		const buffer: StringBufferWithCallbacks = [""] as StringBufferWithCallbacks;
		this.localContexts?.forEach(([context, value]) => {
			context.values.push(value);
		});
		try {
			this.toStringToBuffer(buffer);
		} finally {
			this.localContexts?.forEach(([context]) => {
				context.values.pop();
			});
		}
		return buffer.length === 1
			? "callbacks" in buffer
				? resolveCallbackSync(raw(buffer[0], buffer.callbacks)).toString()
				: buffer[0]
			: stringBufferToString(buffer, buffer.callbacks);
	}

	toStringToBuffer(buffer: StringBufferWithCallbacks): void {
		const tag = this.tag as string;
		const props = this.props;
		let { children } = this;

		buffer[0] += `<${tag}`;

		const normalizeKey: (key: string) => string =
			nameSpaceContext && useContext(nameSpaceContext) === "svg"
				? (key) => toSVGAttributeName(normalizeIntrinsicElementKey(key))
				: (key) => normalizeIntrinsicElementKey(key);
		for (let [key, v] of Object.entries(props)) {
			key = normalizeKey(key);
			if (key === "children") {
				// skip children
			} else if (key === "style" && typeof v === "object") {
				// object to style strings
				let styleStr = "";
				styleObjectForEach(v, (property, value) => {
					if (value != null) {
						styleStr += `${styleStr ? ";" : ""}${property}:${value}`;
					}
				});
				buffer[0] += ' style="';
				escapeToBuffer(styleStr, buffer);
				buffer[0] += '"';
			} else if (typeof v === "string") {
				buffer[0] += ` ${key}="`;
				escapeToBuffer(v, buffer);
				buffer[0] += '"';
			} else if (v === null || v === undefined) {
				// Do nothing
			} else if (typeof v === "number" || (v as HtmlEscaped).isEscaped) {
				buffer[0] += ` ${key}="${v}"`;
			} else if (typeof v === "boolean" && booleanAttributes.includes(key)) {
				if (v) {
					buffer[0] += ` ${key}=""`;
				}
			} else if (key === "dangerouslySetInnerHTML") {
				if (children.length > 0) {
					throw new Error(
						"Can only set one of `children` or `props.dangerouslySetInnerHTML`.",
					);
				}

				children = [raw(v.__html)];
			} else if (v instanceof Promise) {
				buffer[0] += ` ${key}="`;
				buffer.unshift('"', v);
			} else if (typeof v === "function") {
				if (!key.startsWith("on") && key !== "ref") {
					throw new Error(
						`Invalid prop '${key}' of type 'function' supplied to '${tag}'.`,
					);
				}
				// maybe event handler for client components, just ignore in server components
			} else {
				buffer[0] += ` ${key}="`;
				escapeToBuffer(v.toString(), buffer);
				buffer[0] += '"';
			}
		}

		if (emptyTags.includes(tag as string) && children.length === 0) {
			buffer[0] += "/>";
			return;
		}

		buffer[0] += ">";

		childrenToStringToBuffer(children, buffer);

		buffer[0] += `</${tag}>`;
	}
}

class JSXFunctionNode extends JSXNode {
	override toStringToBuffer(buffer: StringBufferWithCallbacks): void {
		const { children } = this;

		// biome-ignore lint/complexity/noBannedTypes: vendored code
		const res = (this.tag as Function).call(null, {
			...this.props,
			children: children.length <= 1 ? children[0] : children,
		});

		if (typeof res === "boolean" || res == null) {
			// boolean or null or undefined
			return;
		} else if (res instanceof Promise) {
			if (globalContexts.length === 0) {
				buffer.unshift("", res);
			} else {
				// save current contexts for resuming
				const currentContexts: LocalContexts = globalContexts.map((c) => [
					c,
					c.values.at(-1),
				]);
				buffer.unshift(
					"",
					res.then((childRes) => {
						if (childRes instanceof JSXNode) {
							childRes.localContexts = currentContexts;
						}
						return childRes;
					}),
				);
			}
		} else if (res instanceof JSXNode) {
			res.toStringToBuffer(buffer);
		} else if (typeof res === "number" || (res as HtmlEscaped).isEscaped) {
			buffer[0] += res;
			if (res.callbacks) {
				buffer.callbacks ||= [];
				buffer.callbacks.push(...res.callbacks);
			}
		} else {
			escapeToBuffer(res, buffer);
		}
	}
}

export class JSXFragmentNode extends JSXNode {
	override toStringToBuffer(buffer: StringBufferWithCallbacks): void {
		childrenToStringToBuffer(this.children, buffer);
	}
}

export const jsx = (
	// biome-ignore lint/complexity/noBannedTypes: vendored code
	tag: string | Function,
	props: Props | null,
	...children: (string | number | HtmlEscapedString)[]
): JSXNode => {
	props ??= {};
	if (children.length) {
		props.children = children.length === 1 ? children[0] : children;
	}

	const key = props.key;
	delete props.key;

	const node = jsxFn(tag, props, children);
	node.key = key;
	return node;
};

export const jsxFn = (
	// biome-ignore lint/complexity/noBannedTypes: vendored code
	tag: string | Function,
	props: Props,
	children: (string | number | HtmlEscapedString)[],
): JSXNode => {
	if (typeof tag === "function") {
		return new JSXFunctionNode(tag, props, children);
	} else if (intrinsicElementTags[tag as keyof typeof intrinsicElementTags]) {
		return new JSXFunctionNode(
			intrinsicElementTags[tag as keyof typeof intrinsicElementTags],
			props,
			children,
		);
	} else if (tag === "svg" || tag === "head") {
		nameSpaceContext ||= createContext("");
		return new JSXNode(tag, props, [
			new JSXFunctionNode(
				nameSpaceContext,
				{
					value: tag,
				},
				children,
			),
		]);
	} else {
		return new JSXNode(tag, props, children);
	}
};

export const shallowEqual = (a: Props, b: Props): boolean => {
	if (a === b) {
		return true;
	}

	const aKeys = Object.keys(a).sort();
	const bKeys = Object.keys(b).sort();
	if (aKeys.length !== bKeys.length) {
		return false;
	}

	for (let i = 0, len = aKeys.length; i < len; i++) {
		const key = aKeys[i];
		if (!key) continue;
		if (
			key === "children" &&
			bKeys[i] === "children" &&
			!a.children?.length &&
			!b.children?.length
		) {
		} else if (a[key] !== b[key]) {
			return false;
		}
	}

	return true;
};

export type MemorableFC<T> = FC<T>;

export const memo = <T>(
	component: FC<T>,
	propsAreEqual: (
		prevProps: Readonly<T>,
		nextProps: Readonly<T>,
	) => boolean = shallowEqual,
): FC<T> => {
	let computed: ReturnType<FC<T>> = null;
	let prevProps: T | undefined;
	const wrapper = (props: T) => {
		if (prevProps && !propsAreEqual(prevProps, props)) {
			computed = null;
		}
		prevProps = props;
		computed ||= component(props);
		return computed;
	};

	return wrapper as FC<T>;
};

export const Fragment = ({
	children,
}: {
	key?: string;
	children?: Child | HtmlEscapedString;
}): HtmlEscapedString => {
	return new JSXFragmentNode(
		"",
		{
			children,
		},
		Array.isArray(children) ? children : children ? [children] : [],
	) as never;
};

export const isValidElement = (element: unknown): element is JSXNode => {
	return !!(
		element &&
		typeof element === "object" &&
		"tag" in element &&
		"props" in element
	);
};

export const cloneElement = <T extends JSXNode | JSX.Element>(
	element: T,
	props: Partial<Props>,
	...children: Child[]
): T => {
	// biome-ignore lint/suspicious/noExplicitAny: vendored code
	let childrenToClone: any;
	if (children.length > 0) {
		childrenToClone = children;
	} else {
		const c = (element as JSXNode).props.children;
		childrenToClone = Array.isArray(c) ? c : [c];
	}
	return jsx(
		(element as JSXNode).tag,
		{ ...(element as JSXNode).props, ...props },
		...childrenToClone,
	) as T;
};

export const reactAPICompatVersion = "19.0.0-hono-jsx";
