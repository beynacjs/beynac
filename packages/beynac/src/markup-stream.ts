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

type StackFrame = {
	stream: MarkupStream;
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

// Helper to flatten nested arrays
function flattenContent(content: Content[]): Content[] {
	const result: Content[] = [];
	for (const item of content) {
		if (Array.isArray(item)) {
			result.push(...flattenContent(item));
		} else {
			result.push(item);
		}
	}
	return result;
}

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
			this.content = children ? flattenContent(children) : null;
		}
	}

	renderChunks(): Chunk {
		let buffer = "";
		const nodeStack: StackFrame[] = [];

		const getNextChunk = (): Chunk => {
			while (true) {
				// Check if we're done
				if (nodeStack.length === 0) {
					return [buffer, null];
				}

				const frame = nodeStack[nodeStack.length - 1];

				// Check if we've processed all children at this level
				if (
					!frame.stream.content ||
					frame.index >= frame.stream.content.length
				) {
					// Close the current stream's tag
					renderClosingTag(frame.stream);
					nodeStack.pop();

					// Move to next sibling in parent level if exists
					if (nodeStack.length > 0) {
						nodeStack[nodeStack.length - 1].index++;
					}
					continue;
				}

				const node = frame.stream.content[frame.index];

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
							if (currentFrame.stream.content && Array.isArray(resolved)) {
								const flattened = flattenContent([resolved]);
								currentFrame.stream.content.splice(
									currentFrame.index,
									1,
									...flattened,
								);
							} else if (currentFrame.stream.content) {
								currentFrame.stream.content[currentFrame.index] = resolved;
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
					// Push with index: 0 to start processing children
					nodeStack.push({ stream: node, index: 0 });
					// Don't increment parent's index here - it will be incremented when we pop back
					continue;
				}

				// Arrays should have been flattened
				if (Array.isArray(node)) {
					throw new Error(
						"Unexpected nested array - should have been flattened",
					);
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

		// Helper closure to render closing tag
		const renderClosingTag = (stream: MarkupStream): void => {
			if (stream.tag) {
				buffer += `</${stream.tag}>`;
			}
		};

		// Render opening tag for root stream immediately
		renderOpeningTag(this);
		// Push root MarkupStream with index: 0 to start processing children
		nodeStack.push({ stream: this, index: 0 });

		return getNextChunk();
	}
}
