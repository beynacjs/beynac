/** @jsxImportSource ./ */
// biome-ignore-all lint/complexity/noUselessFragments: we're testing fragments
import { expect, test } from "bun:test";

test("renders single element with attributes and text child", async () => {
  expect(await (<span id="foo">hello</span>).render()).toBe(
    '<span id="foo">hello</span>'
  );
});

test("renders childless non-empty elements", async () => {
  expect(await (<span id="foo" />).render()).toBe('<span id="foo"></span>');
});

test("renders empty tags", async () => {
  expect(await (<input value="yo" />).render()).toBe('<input value="yo">');
});

test("escapes attribute values", async () => {
  expect(
    await (<input value={`I'm a "little" <teapot> short & stout`} />).render()
  ).toBe(
    `<input value="I'm a &quot;little&quot; &lt;teapot&gt; short &amp; stout">`
  );
});

test("shortens boolean attributes", async () => {
  expect(await (<input type="checkbox" checked />).render()).toBe(
    `<input type="checkbox" checked>`
  );
});

test("renders children", async () => {
  expect(
    await (
      <div>
        <input type="checkbox" checked />
      </div>
    ).render()
  ).toBe(`<div><input type="checkbox" checked></div>`);
});

test("renders fragments", async () => {
  expect(
    await (
      <>
        <div>hello</div>
      </>
    ).render()
  ).toBe(`<div>hello</div>`);
});

test("renders components", async () => {
  const Component = (props: { value: number }) => (
    <span the-value={props.value} />
  );
  expect(
    await (
      <div>
        <Component value={42} />
      </div>
    ).render()
  ).toBe(`<div><span the-value="42"></span></div>`);
});

test("does not evaluate components until rendered", async () => {
  let evaluated = false;
  const Component = () => {
    evaluated = true;
    return <result />;
  };
  const jsx = <Component />;
  expect(evaluated).toBeFalse();
  await jsx.render();
  expect(evaluated).toBeTrue();
});
