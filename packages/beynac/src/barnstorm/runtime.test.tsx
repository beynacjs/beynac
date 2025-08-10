/** @jsxImportSource ./ */
// biome-ignore-all lint/complexity/noUselessFragments: we're testing fragments
import { expect, test } from "bun:test";

test("renders single element with attributes and text child", () => {
	expect((<span id="foo">hello</span>).render()).toBe(
		'<span id="foo">hello</span>',
	);
});

test("renders childless non-empty elements", () => {
	expect((<span id="foo" />).render()).toBe('<span id="foo"></span>');
});

test("renders empty tags", () => {
	debugger;
	expect((<input value="yo" />).render()).toBe('<input value="yo">');
});

test("escapes attribute values", () => {
	expect(
		(<input value={`I'm a "little" <teapot> short & stout`} />).render(),
	).toBe(
		`<input value="I'm a &quot;little&quot; &lt;teapot&gt; short &amp; stout">`,
	);
});

test("shortens boolean attributes", () => {
	expect((<input type="checkbox" checked />).render()).toBe(
		`<input type="checkbox" checked>`,
	);
});

test("renders children", () => {
	expect(
		(
			<div>
				<input type="checkbox" checked />
			</div>
		).render(),
	).toBe(`<div><input type="checkbox" checked></div>`);
});

test.skip("renders fragments", () => {
	// expect(
	// 	(
	// 		<>
	// 			<div>hello</div>
	// 		</>
	// 	).render(),
	// ).toBe(`<div><input type="checkbox" checked></div>`);
});
