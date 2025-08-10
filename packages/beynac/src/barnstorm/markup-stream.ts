import type { Chunk, Content, JSX } from "./public-types";
import { RawContent } from "./raw";

export type RenderOptions = {
	mode?: "html" | "xml";
};

export class MarkupStream implements JSX.Element {
	readonly tag: string | null;
	readonly attributes: Record<string, unknown> | null;
	readonly content: Content[] | null;

	constructor(
		tag: string | null,
		attributes: Record<string, unknown> | null,
		children: Array<Content> | null | Promise<Array<Content> | null>,
	) {
		this.tag = tag;
		this.attributes = attributes;

		if (children instanceof Promise) {
			// Just wrap the promise as content - it will be handled during rendering
			this.content = [children];
		} else {
			this.content = children;
		}
	}

	renderChunks({ mode = "html" }: RenderOptions = {}): Chunk {
		let buffer = "";
		const nodeStack: StackFrame[] = [];

		const getNextChunk = (): Chunk => {
			while (true) {
				const frame = nodeStack.at(-1);

				if (!frame) return [buffer, null];

				if (!frame.content || frame.index >= frame.content.length) {
					if (frame.tag) {
						const needsClosing = 
							mode === "html"
								// in html mode, tags need closing unless they're one of the known empty tags
								? !emptyTags.has(frame.tag)
								// in xml mode, tags need closing if they have content (empty tags will be rendered as <self-closing />)
								: !!frame.content?.length;
						if (needsClosing) {
							buffer += "</";
							buffer += frame.tag;
							buffer += ">";
						}
					}
					nodeStack.pop();

					const parentFrame = nodeStack.at(-1);
					if (parentFrame) {
						parentFrame.index++;
					}
					continue;
				}

				const node = frame.content[frame.index];

				if (node instanceof Promise) {
					const currentBuffer = buffer;
					const currentFrame = frame;
					buffer = "";
					return [
						currentBuffer,
						node.then((resolved) => {
							if (currentFrame.content) {
								currentFrame.content[currentFrame.index] = resolved;
							}
							// we've replaced the promise with its resolved
							// value so we can continue from the same position
							return getNextChunk();
						}),
					];
				} else if (node instanceof MarkupStream) {
					pushStackFrame(node.content, node.tag, node.attributes);
				} else if (Array.isArray(node)) {
					pushStackFrame(node, null, null);
				} else {
					// Primitive value: render as content
					if (node != null && typeof node !== "boolean") {
						if (node instanceof RawContent) {
							buffer += node;
						} else {
							buffer += escapeHtml(String(node));
						}
					}
					frame.index++;
				}
			}
		};

		const renderOpeningTag = (
			tag: string,
			attributes: Record<string, unknown> | null,
			selfClosing: boolean,
		): void => {
			if (!tag) return;

			buffer += "<";
			buffer += tag;

			if (attributes) {
				for (const [key, value] of Object.entries(attributes)) {
					if (value == null) {
						continue;
					}

					if (mode === "html" && booleanAttributes.has(key)) {
						// HTML mode: boolean attributes
						if (value === true) {
							buffer += " ";
							buffer += key;
						} else if (value === false) {
							// Omit false boolean attributes in HTML
						} else {
							// Non-boolean value for a boolean attribute
							buffer += " ";
							buffer += key;
							buffer += '="';
							buffer += escapeHtml(String(value));
							buffer += '"';
						}
					} else {
						// XML mode or non-boolean attributes in HTML
						buffer += " ";
						buffer += key;
						buffer += '="';
						buffer += escapeHtml(String(value));
						buffer += '"';
					}
				}
			}

			if (selfClosing) {
				buffer += " />";
			} else {
				buffer += ">";
			}
		};

		const pushStackFrame = (
			content: Content[] | null,
			tag: string | null,
			attributes: Record<string, unknown> | null,
		): void => {
			const selfClosing = mode === "xml" && !content?.length;
			if (tag) {
				renderOpeningTag(tag, attributes, selfClosing);
			}
			const htmlEmptyTag = tag && mode === "html" && emptyTags.has(tag);
			nodeStack.push({ content: htmlEmptyTag ? [] : (content ?? []), tag, index: 0 });
		};

		pushStackFrame(this.content, this.tag, this.attributes);

		return getNextChunk();
	}

	render(options?: RenderOptions): string | Promise<string> {
		let [content, next] = this.renderChunks(options);

		if (!next) {
			return content;
		}

		return (async () => {
			while (next) {
				const [chunkContent, chunkNext]: Chunk = await next;
				content += chunkContent;
				next = chunkNext;
			}
			return content;
		})();
	}
}

type StackFrame = {
	content: Content[];
	tag: string | null;
	index: number;
};

const HTML_ESCAPE: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
};

const escapeHtml = (str: string) =>
	str.replace(/[&<>"]/g, (ch) => HTML_ESCAPE[ch]);

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
