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
				if (nodeStack.length === 0) {
					return [buffer, null];
				}

				const frame = nodeStack[nodeStack.length - 1];

				// Check if we've processed all children at this level
				if (!frame.content || frame.index >= frame.content.length) {
					// Close the tag if this frame has one
					if (frame.tag) {
						buffer += `</${frame.tag}>`;
					}
					nodeStack.pop();

					// Move to next sibling in parent level if exists
					if (nodeStack.length > 0) {
						nodeStack[nodeStack.length - 1].index++;
					}
					continue;
				}

				const node = frame.content[frame.index];

				// Handle null/undefined/boolean
				if (node == null || typeof node === "boolean") {
					frame.index++;
					continue;
				}

				// Handle strings and numbers
				if (typeof node === "string") {
					buffer += node;
					frame.index++;
					continue;
				}

				if (typeof node === "number") {
					buffer += String(node);
					frame.index++;
					continue;
				}

				// Handle promises
				if (node instanceof Promise) {
					const currentChunk = buffer;
					const currentFrame = frame; // Capture for closure
					buffer = ""; // Clear buffer after capturing
					return [
						currentChunk,
						node.then((resolved) => {
							if (currentFrame.content) {
								currentFrame.content[currentFrame.index] = resolved;
							}
							// Don't increment position - reprocess at same index
							return getNextChunk();
						}),
					];
				}

				// Handle nested MarkupStream
				if (node instanceof MarkupStream) {
					// Render opening tag immediately when entering the stream
					renderOpeningTag(node);
					// Push the stream's content array with its tag for closing later
					nodeStack.push({ content: node.content, tag: node.tag, index: 0 });
					// Don't increment parent's index here - it will be incremented when we pop back
					continue;
				}

				// Handle arrays - push them onto the stack without a tag
				if (Array.isArray(node)) {
					nodeStack.push({ content: node, tag: null, index: 0 });
					// Don't increment parent's index here - it will be incremented when we pop back
					continue;
				}

				// Unknown type - skip
				frame.index++;
			}
		};

		// Helper closure to render opening tag - eliminates duplication
		const renderOpeningTag = (stream: MarkupStream): void => {
			if (!stream.tag) return;

			buffer += "<";
			buffer += stream.tag;

			if (stream.attributes) {
				for (const [key, value] of Object.entries(stream.attributes)) {
					if (
						value === null ||
						value === undefined ||
						typeof value === "function"
					) {
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

		// Render opening tag for root stream immediately
		renderOpeningTag(this);
		// Push root content array with tag for closing later
		nodeStack.push({ content: this.content, tag: this.tag, index: 0 });

		return getNextChunk();
	}
}


type StackFrame = {
	content: Content[] | null;
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