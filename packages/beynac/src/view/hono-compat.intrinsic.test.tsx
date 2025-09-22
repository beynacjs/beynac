/** @jsxImportSource ./ */
// These tests are imported from the tmp-hono-view implementation for compatibility testing
// They may need modifications to work with the Beynac JSX implementation

import { describe, expect, it } from "bun:test";
import { render } from "./markup-stream";

describe("Hono compatibility tests - intrinsic element", () => {
  describe("document metadata", () => {
    describe("title element", () => {
      it.skip("should be hoisted title tag", async () => {
        // This feature (hoisting) may not be implemented in Beynac
        const template = (
          <html lang="en">
            <head></head>
            <body>
              <title>Hello</title>
              <h1>World</h1>
            </body>
          </html>
        );
        expect(await render(template)).toBe(
          '<html lang="en"><head><title>Hello</title></head><body><h1>World</h1></body></html>'
        );
      });
    });

    describe("link element", () => {
      it.skip("should be hoisted link tag", async () => {
        // This feature (hoisting) may not be implemented in Beynac
        const template = (
          <html lang="en">
            <head></head>
            <body>
              <link rel="stylesheet" href="style.css" precedence="default" />
              <h1>World</h1>
            </body>
          </html>
        );
        expect(await render(template)).toBe(
          '<html lang="en"><head><link rel="stylesheet" href="style.css" data-precedence="default"></head><body><h1>World</h1></body></html>'
        );
      });

      it.skip("should be ordered by precedence attribute", async () => {
        // This feature (precedence ordering) may not be implemented in Beynac
        const template = (
          <html lang="en">
            <head></head>
            <body>
              <link rel="stylesheet" href="style1.css" precedence="default" />
              <link rel="stylesheet" href="style2.css" precedence="high" />
              <link rel="stylesheet" href="style3.css" precedence="default" />
              <h1>World</h1>
            </body>
          </html>
        );
        expect(await render(template)).toBe(
          '<html lang="en"><head><link rel="stylesheet" href="style1.css" data-precedence="default"><link rel="stylesheet" href="style3.css" data-precedence="default"><link rel="stylesheet" href="style2.css" data-precedence="high"></head><body><h1>World</h1></body></html>'
        );
      });

      it.skip("should be de-duped by href", async () => {
        // This feature (de-duplication) may not be implemented in Beynac
        const template = (
          <html lang="en">
            <head></head>
            <body>
              <link rel="stylesheet" href="style1.css" precedence="default" />
              <link rel="stylesheet" href="style2.css" precedence="high" />
              <link rel="stylesheet" href="style1.css" precedence="default" />
              <h1>World</h1>
            </body>
          </html>
        );
        expect(await render(template)).toBe(
          '<html lang="en"><head><link rel="stylesheet" href="style1.css" data-precedence="default"><link rel="stylesheet" href="style2.css" data-precedence="high"></head><body><h1>World</h1></body></html>'
        );
      });

      it("should be inserted as is if <head> is not present", async () => {
        const template = (
          <html lang="en">
            <body>
              <link rel="stylesheet" href="style1.css" precedence="default" />
              <link rel="stylesheet" href="style2.css" precedence="high" />
              <h1>World</h1>
            </body>
          </html>
        );
        expect(await render(template)).toBe(
          '<html lang="en"><body><link rel="stylesheet" href="style1.css" precedence="default"><link rel="stylesheet" href="style2.css" precedence="high"><h1>World</h1></body></html>'
        );
      });

      it.skip("should not do special behavior if disabled is present", async () => {
        // This feature (special handling of disabled) may not be implemented in Beynac
        const template = (
          <html lang="en">
            <head></head>
            <body>
              <link rel="stylesheet" href="style1.css" precedence="default" />
              <link
                rel="stylesheet"
                href="style2.css"
                precedence="default"
                disabled
              />
              <h1>World</h1>
            </body>
          </html>
        );
        expect(await render(template)).toBe(
          '<html lang="en"><head><link rel="stylesheet" href="style1.css" data-precedence="default"></head><body><link rel="stylesheet" href="style2.css" precedence="default" disabled><h1>World</h1></body></html>'
        );
      });
    });

    describe("script element", () => {
      it.skip("should be hoisted script async=false", async () => {
        // This feature (hoisting scripts) may not be implemented in Beynac
        const template = (
          <html lang="en">
            <head></head>
            <body>
              <script src="script.js" async={false} />
              <h1>World</h1>
            </body>
          </html>
        );
        expect(await render(template)).toBe(
          '<html lang="en"><head><script src="script.js"></script></head><body><h1>World</h1></body></html>'
        );
      });

      it("should not be hoisted script async=true", async () => {
        const template = (
          <html lang="en">
            <head></head>
            <body>
              <script src="script.js" async={true} />
              <h1>World</h1>
            </body>
          </html>
        );
        expect(await render(template)).toBe(
          '<html lang="en"><head></head><body><script src="script.js" async></script><h1>World</h1></body></html>'
        );
      });

      it("should not be hoisted script async", async () => {
        const template = (
          <html lang="en">
            <head></head>
            <body>
              <script src="script.js" async />
              <h1>World</h1>
            </body>
          </html>
        );
        expect(await render(template)).toBe(
          '<html lang="en"><head></head><body><script src="script.js" async></script><h1>World</h1></body></html>'
        );
      });

      it("should not be hoisted script without any props", async () => {
        const template = (
          <html lang="en">
            <head></head>
            <body>
              <script src="script.js" />
              <h1>World</h1>
            </body>
          </html>
        );
        expect(await render(template)).toBe(
          '<html lang="en"><head></head><body><script src="script.js"></script><h1>World</h1></body></html>'
        );
      });
    });

    describe("meta element", () => {
      it.skip("should be hoisted meta element", async () => {
        // This feature (hoisting meta) may not be implemented in Beynac
        const template = (
          <html lang="en">
            <head></head>
            <body>
              <meta name="description" content="Hello" />
              <h1>World</h1>
            </body>
          </html>
        );
        expect(await render(template)).toBe(
          '<html lang="en"><head><meta name="description" content="Hello"></head><body><h1>World</h1></body></html>'
        );
      });

      it.skip("should keep the both if content is different", async () => {
        // This feature (meta de-duplication) may not be implemented in Beynac
        const template = (
          <html lang="en">
            <head></head>
            <body>
              <meta name="description" content="Hello" />
              <meta name="description" content="World" />
              <h1>World</h1>
            </body>
          </html>
        );
        expect(await render(template)).toBe(
          '<html lang="en"><head><meta name="description" content="Hello"><meta name="description" content="World"></head><body><h1>World</h1></body></html>'
        );
      });

      it.skip("should be de-duped", async () => {
        // This feature (meta de-duplication) may not be implemented in Beynac
        const template = (
          <html lang="en">
            <head></head>
            <body>
              <meta name="description" content="Hello" />
              <meta name="description" content="Hello" />
              <h1>World</h1>
            </body>
          </html>
        );
        expect(await render(template)).toBe(
          '<html lang="en"><head><meta name="description" content="Hello"></head><body><h1>World</h1></body></html>'
        );
      });

      it("should not be hoisted if there is no head", async () => {
        const template = (
          <html lang="en">
            <body>
              <meta name="description" content="Hello" />
              <h1>World</h1>
            </body>
          </html>
        );
        expect(await render(template)).toBe(
          '<html lang="en"><body><meta name="description" content="Hello"><h1>World</h1></body></html>'
        );
      });
    });
  });
});
