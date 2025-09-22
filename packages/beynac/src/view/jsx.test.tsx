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

test("renders style attribute from object", async () => {
  const result = await render(
    <div
      style={{
        color: "red",
        backgroundColor: "blue",
        height: undefined,
        fontSize: 14,
      }}
    />
  );
  expect(result).toBe(
    '<div style="color:red;background-color:blue;font-size:14px"></div>'
  );
});

test("passing an array or other invalid value to style causes type error", async () => {
  // @ts-expect-error testing invalid usage
  await render(<div style={[]} />);
  // @ts-expect-error testing invalid usage
  await render(<div style={4} />);
  // @ts-expect-error testing invalid usage
  await render(<div style={Symbol()} />);
});

/**
 * 
 * 
 
   test("catches incorrect value types with @ts-expect-error", () => {
     styleObjectToString({
       // @ts-expect-error: testing expected error
       textAlign: "invalid",
     });
 
     styleObjectToString({
       // @ts-expect-error: testing expected error
       color: 123, // color should be a string, not a number
     });
   });
 */

test("passing invalid style values in object causes type error", async () => {
  void (<div style={{ textAlign: "center" }} />);
  void (
    <div
      style={{
        // @ts-expect-error testing invalid usage
        textAlign: "invalid",
      }}
    />
  );
  void (<div style={{ flex: 4 }} />);
  void (
    <div
      style={{
        // @ts-expect-error testing invalid usage
        color: 4,
      }}
    />
  );
});

test("omits style attribute on no object styles", async () => {
  const result = await render(
    <div
      style={{
        height: undefined,
      }}
    />
  );
  expect(result).toBe("<div></div>");
});

test("does not omit empty string style attribute", async () => {
  const result = await render(<span style="" />);
  expect(result).toBe('<span style=""></span>');
});
