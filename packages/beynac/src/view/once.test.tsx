/** @jsxImportSource ./ */
import { expect, test } from "bun:test";
import { html } from "./html";
import { render } from "./markup-stream";
import { Once } from "./once";
import type { Component } from "./public-types";

test("Once renders content the first time a key is encountered", async () => {
  const result = await render(
    <div>
      <Once key="test1">First</Once>
      <Once key="test2">Second</Once>
    </div>,
  );
  expect(result).toBe("<div>FirstSecond</div>");
});

test("Once returns null when the same key is encountered again", async () => {
  const result = await render(
    <div>
      <Once key="same">First appearance</Once>
      <Once key="same">Second appearance</Once>
      <Once key="same">Third appearance</Once>
    </div>,
  );
  expect(result).toBe("<div>First appearance</div>");
});

test("Once works with different keys", async () => {
  const result = await render(
    <div>
      <Once key="a">A</Once>
      <Once key="b">B</Once>
      <Once key="a">A again</Once>
      <Once key="c">C</Once>
      <Once key="b">B again</Once>
    </div>,
  );
  expect(result).toBe("<div>ABC</div>");
});

test("Once works with complex children", async () => {
  const result = await render(
    <div>
      <Once key="complex">
        <span>
          <strong>Bold</strong> text
        </span>
      </Once>
      <Once key="complex">
        <span>This should not appear</span>
      </Once>
    </div>,
  );
  expect(result).toBe("<div><span><strong>Bold</strong> text</span></div>");
});

test("Once works within components", async () => {
  const Header: Component = () => (
    <Once key="header">
      <style>{`h1 { color: blue; }`}</style>
    </Once>
  );

  const Page: Component = () => (
    <div>
      <Header />
      <h1>Page 1</h1>
      <Header />
      <h1>Page 2</h1>
    </div>
  );

  const result = await render(<Page />);
  expect(result).toBe(
    "<div><style>h1 { color: blue; }</style><h1>Page 1</h1><h1>Page 2</h1></div>",
  );
});

test("Once with null or undefined children", async () => {
  const result = await render(
    <div>
      <Once key="null">{null}</Once>
      <Once key="undefined">{undefined}</Once>
      <Once key="false">{false}</Once>
      Text after
    </div>,
  );
  expect(result).toBe("<div>Text after</div>");
});

test("Once with arrays of children", async () => {
  const result = await render(
    <div>
      <Once key="array">
        {["Item 1", " ", "Item 2"].map((item) => (
          <span>{item}</span>
        ))}
      </Once>
      <Once key="array">Should not appear</Once>
    </div>,
  );
  expect(result).toBe(
    "<div><span>Item 1</span><span> </span><span>Item 2</span></div>",
  );
});

test("Once persists state across nested components", async () => {
  const ChildA: Component = () => (
    <>
      <Once key="shared">From A</Once>
      <span>A</span>
    </>
  );

  const ChildB: Component = () => (
    <>
      <Once key="shared">From B</Once>
      <span>B</span>
    </>
  );

  const Parent: Component = () => (
    <div>
      <ChildA />
      <ChildB />
    </div>
  );

  const result = await render(<Parent />);
  expect(result).toBe("<div>From A<span>A</span><span>B</span></div>");
});

test("Once uses source position as key when key prop is not provided", async () => {
  const result = await render(
    <div>
      <Once>First occurrence without key</Once>
      <Once>Second occurrence without key on different line</Once>
    </div>,
  );
  // Both should render because they're on different lines
  expect(result).toBe(
    "<div>First occurrence without keySecond occurrence without key on different line</div>",
  );
});

test("Once deduplicates when same source position in loop", async () => {
  const items = [1, 2, 3];
  const result = await render(
    <div>
      {items.map(() => (
        <Once>Same position in loop</Once>
      ))}
    </div>,
  );
  // Should only render once because all iterations have the same source position
  expect(result).toBe("<div>Same position in loop</div>");
});

test("Once deduplicates when different source positions on same line", async () => {
  const result = await render(html`${(<Once>A</Once>)}${(<Once>B</Once>)}`);
  expect(result).toBe("AB");
});

test("Once works across multiple renders", async () => {
  const Component1: Component = () => (
    <div>
      <Once key="style">
        <style>{`body { margin: 0; }`}</style>
      </Once>
      <h1>Page 1</h1>
    </div>
  );

  const jsx = <Component1 />;

  expect(await render(jsx)).toBe(
    "<div><style>body { margin: 0; }</style><h1>Page 1</h1></div>",
  );

  expect(await render(jsx)).toBe(
    "<div><style>body { margin: 0; }</style><h1>Page 1</h1></div>",
  );
});
