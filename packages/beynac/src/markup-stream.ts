export type Content =
	| string
	| number
	| MarkupStream
	| null
	| undefined
	| boolean
	| Promise<Content>
	| Content[];

export type Chunk = [string, Promise<Chunk> | null];

export class MarkupStream {
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

	renderChunks(): Chunk {
		let buffer = "";
		const nodeStack: StackFrame[] = [];

		const getNextChunk = (): Chunk => {
			while (true) {
				const frame = nodeStack.at(-1);

				if (!frame) return [buffer, null];

				if (!frame.content || frame.index >= frame.content.length) {
					// Finished processing this frame
					if (frame.tag) {
						buffer += "</";
						buffer += frame.tag;
						buffer += ">";
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
						buffer += String(node);
					}
					frame.index++;
				}
			}
		};

		const renderOpeningTag = (
			tag: string,
			attributes: Record<string, unknown> | null,
		): void => {
			if (!tag) return;

			buffer += "<";
			buffer += tag;

			if (attributes) {
				for (const [key, value] of Object.entries(attributes)) {
					if (value == null) {
						continue;
					}

					if (typeof value === "boolean") {
						if (value) {
							buffer += " ";
							buffer += key;
						}
					} else {
						buffer += " ";
						buffer += key;
						buffer += '="';
						buffer += escapeHtml(String(value));
						buffer += '"';
					}
				}
			}

			buffer += ">";
		};

		const pushStackFrame = (
			content: Content[] | null,
			tag: string | null,
			attributes: Record<string, unknown> | null,
		): void => {
			if (tag) {
				renderOpeningTag(tag, attributes);
			}
			nodeStack.push({ content: content ?? [], tag, index: 0 });
		};

		pushStackFrame(this.content, this.tag, this.attributes);

		return getNextChunk();
	}

	render(): string | Promise<string> {
		let [content, next] = this.renderChunks();

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
