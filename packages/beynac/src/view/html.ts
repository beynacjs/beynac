import { MarkupStream } from "./markup-stream";
import type { Content } from "./public-types";
import { RawContent } from "./raw";

export function html(
	strings: TemplateStringsArray,
	...values: Content[]
): MarkupStream {
	const content: Content[] = [];

	for (let i = 0; i < strings.length; i++) {
		if (strings[i]) {
			// Template literal strings are treated as raw HTML (not escaped)
			content.push(new RawContent(strings[i]));
		}
		if (i < values.length) {
			// Interpolated values will be escaped by MarkupStream unless they're RawContent
			content.push(values[i]);
		}
	}

	return new MarkupStream(null, null, content);
}
