import { describe, expect, test } from "bun:test";
import { html } from "./html";
import { raw } from "./raw";

describe("html template literal", () => {
  describe("basic functionality", () => {
    test("renders simple HTML template", () => {
      const result = html`<div>Hello World</div>`;
      expect(result.render()).toBe("<div>Hello World</div>");
    });

    test("gives type error on invalid interpolation", () => {
      // @ts-expect-error asserting error for test
      void html`<div>${Symbol()}</div>`;
    });

    test("interpolates values", () => {
      const name = "Alice";
      const result = html`<div>Hello ${name}</div>`;
      expect(result.render()).toBe("<div>Hello Alice</div>");
    });

    test("handles multiple interpolations", () => {
      const result = html`<div>${"hello"} ${" "} ${"world"}</div>`;
      expect(result.render()).toBe("<div>hello   world</div>");
    });

    test("interpolates numbers", () => {
      const result = html`<span>Count: ${42}</span>`;
      expect(result.render()).toBe("<span>Count: 42</span>");
    });

    test("escapes interpolated strings by default", () => {
      const dangerous = "<script>alert('xss')</script>";
      const result = html`<div>${dangerous}</div>`;
      expect(result.render()).toBe(
        "<div>&lt;script&gt;alert('xss')&lt;/script&gt;</div>"
      );
    });
  });

  describe("raw content", () => {
    test("preserves raw content", () => {
      const result = html`<div>${raw("<b>bold</b>")}</div>`;
      expect(result.render()).toBe("<div><b>bold</b></div>");
    });
  });

  describe("async support", () => {
    test("handles promise interpolation", async () => {
      const result = html`<div>${Promise.resolve("async content")}</div>`;
      const rendered = await result.render();
      expect(rendered).toBe("<div>async content</div>");
    });

    test("handles multiple async values", async () => {
      const result = html`<div>
        ${Promise.resolve("first")} ${Promise.resolve("second")}
      </div>`;
      const rendered = await result.render();
      expect(rendered).toBe("<div>first second</div>");
    });
  });

  describe("edge cases", () => {
    test("handles null and undefined", () => {
      const result = html`<div>${null} ${undefined}</div>`;
      expect(result.render()).toBe("<div> </div>");
    });

    test("skips boolean values", () => {
      const result = html`<div>${true} ${false}</div>`;
      expect(result.render()).toBe("<div> </div>");
    });

    test("handles empty template", () => {
      const result = html``;
      expect(result.render()).toBe("");
    });

    test("handles nested html templates", () => {
      const inner = html`<span>inner</span>`;
      const result = html`<div>${inner}</div>`;
      expect(result.render()).toBe("<div><span>inner</span></div>");
    });

    test("handles arrays", () => {
      const items = ["a", "b", "c"];
      const result = html`<ul>
        ${items.map((item) => html`<li>${item}</li>`)}
      </ul>`;
      expect(result.render()).toBe("<ul><li>a</li><li>b</li><li>c</li></ul>");
    });
  });
});
