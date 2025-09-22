/** @jsxImportSource ./ */
import { expect, test } from "bun:test";
import { render } from "./markup-stream";

test("renders single element with attributes and text child", async () => {
  expect(await render(<span id="foo">hello</span>)).toBe(
    '<span id="foo">hello</span>'
  );
});

test("renders childless non-empty elements", async () => {
  expect(await render(<span id="foo" />)).toBe('<span id="foo"></span>');
});

test("renders empty tags", async () => {
  expect(await render(<input value="yo" />)).toBe('<input value="yo">');
});

test("throws error for void elements with children", async () => {
  expect(render(<link>content</link>)).rejects.toThrow(
    "<link> is a void element and must not have children"
  );

  expect(render(<input>text</input>)).rejects.toThrow(
    "<input> is a void element and must not have children"
  );
});

test("escapes attribute values", async () => {
  expect(
    await render(<input value={`I'm a "little" <teapot> short & stout`} />)
  ).toBe(
    `<input value="I'm a &quot;little&quot; &lt;teapot&gt; short &amp; stout">`
  );
});

test("shortens boolean attributes", async () => {
  expect(await render(<input type="checkbox" checked />)).toBe(
    `<input type="checkbox" checked>`
  );
});

test("renders children", async () => {
  expect(
    await render(
      <div>
        <input type="checkbox" checked />
      </div>
    )
  ).toBe(`<div><input type="checkbox" checked></div>`);
});

test("renders fragments", async () => {
  expect(
    await render(
      <>
        <div>hello</div>
      </>
    )
  ).toBe(`<div>hello</div>`);
});

test("renders components", async () => {
  const Component = (props: { value: number }) => (
    <span the-value={props.value} />
  );
  expect(
    await render(
      <div>
        <Component value={42} />
      </div>
    )
  ).toBe(`<div><span the-value="42"></span></div>`);
});

test("provides correct stack when a component throws an error", async () => {
  const Component = () => {
    throw new Error("Intentional error");
  };
  expect(Component.name).toBe("Component");
  expect(
    render(
      <div>
        <Component />
      </div>
    )
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"Rendering error: Intentional error; Component stack: <div> -> <Component>"`
  );
});

test("Respects displayName in component stacks", async () => {
  const Component = () => {
    throw new Error("Intentional error");
  };
  Component.displayName = "MyDisplayName";
  expect(Component.name).toBe("Component");
  expect(
    render(
      <div>
        <Component />
      </div>
    )
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"Rendering error: Intentional error; Component stack: <div> -> <MyDisplayName>"`
  );
});

test("does not evaluate components until rendered", async () => {
  let evaluated = false;
  const Component = () => {
    evaluated = true;
    return <result />;
  };
  const jsx = <Component />;
  expect(evaluated).toBeFalse();
  await render(jsx);
  expect(evaluated).toBeTrue();
});
