/** @jsxImportSource ./barnstorm */
import { expect, test } from "bun:test";

test("scratch", () => {
	const typed = <span id="foo">hello</span>;
	console.log(typed);
	expect(<span id="foo">hello</span>).toBe('<span id="foo">hello</span>');
});
