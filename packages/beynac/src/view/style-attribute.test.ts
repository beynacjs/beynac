import { describe, expect, test } from "bun:test";
import { styleObjectToString } from "./style-attribute";

describe("styleObjectToString", () => {
  test("converts camelCase to kebab-case", () => {
    expect(
      styleObjectToString({
        backgroundColor: "red",
        fontSize: "16px",
        borderTopWidth: "1px",
      })
    ).toBe("background-color:red;font-size:16px;border-top-width:1px");
  });

  test("adds px units to numeric values", () => {
    expect(
      styleObjectToString({
        width: 100,
        height: 50,
        fontSize: 14,
        marginTop: 20,
        padding: 10,
      })
    ).toBe(
      "width:100px;height:50px;font-size:14px;margin-top:20px;padding:10px"
    );
  });

  test("does not add px to unitless properties", () => {
    expect(
      styleObjectToString({
        opacity: 0.5,
        zIndex: 10,
        fontWeight: 700,
        lineHeight: 1.5,
        flexGrow: 2,
        flexShrink: 1,
        order: 3,
      })
    ).toBe(
      "opacity:0.5;z-index:10;font-weight:700;line-height:1.5;flex-grow:2;flex-shrink:1;order:3"
    );
  });

  test("handles new React 19+ unitless properties", () => {
    expect(
      styleObjectToString({
        aspectRatio: 1.5,
        scale: 2,
        gridArea: 1,
        animationIterationCount: 3,
      })
    ).toBe("aspect-ratio:1.5;scale:2;grid-area:1;animation-iteration-count:3");
  });

  test("preserves CSS variables", () => {
    expect(
      styleObjectToString({
        "--custom-color": "blue",
        "--spacing": 10,
        "--my-var": "value",
      })
    ).toBe("--custom-color:blue;--spacing:10px;--my-var:value");
  });

  test("handles mixed string and number values", () => {
    expect(
      styleObjectToString({
        color: "red",
        width: 100,
        fontSize: "2em",
        margin: "10px 20px",
      })
    ).toBe("color:red;width:100px;font-size:2em;margin:10px 20px");
  });

  test("skips null and undefined values", () => {
    expect(
      styleObjectToString({
        color: "red",
        width: null as unknown as string,
        height: undefined as unknown as string,
        fontSize: 14,
      })
    ).toBe("color:red;font-size:14px");
  });

  test("handles empty object", () => {
    expect(styleObjectToString({})).toBe("");
  });

  test("handles vendor prefixes", () => {
    expect(
      styleObjectToString({
        WebkitTransform: "scale(1.5)",
        MozTransform: "scale(1.5)",
        MsTransform: "scale(1.5)",
      })
    ).toBe(
      "-webkit-transform:scale(1.5);-moz-transform:scale(1.5);-ms-transform:scale(1.5)"
    );
  });

  test("handles vendor-prefixed unitless properties", () => {
    expect(
      styleObjectToString({
        WebkitFlex: 1,
        MozBoxFlex: 2,
        MsFlexGrow: 3,
        WebkitLineClamp: 4,
        WebkitBorderRadius: 5, // Not unitless - should get px
      })
    ).toBe(
      "-webkit-flex:1;-moz-box-flex:2;-ms-flex-grow:3;-webkit-line-clamp:4;-webkit-border-radius:5px"
    );
  });

  test("handles already kebab-cased properties", () => {
    expect(
      styleObjectToString({
        "background-color": "red",
        "font-size": "16px",
      })
    ).toBe("background-color:red;font-size:16px");
  });

  test("handles zero values", () => {
    expect(
      styleObjectToString({
        margin: 0,
        padding: 0,
        opacity: 0,
      })
    ).toBe("margin:0px;padding:0px;opacity:0");
  });
});
