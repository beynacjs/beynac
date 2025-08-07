import { describe, expect, mock, test } from "bun:test";
import { normalizeIntrinsicElementKey, styleObjectForEach } from "./utils";

describe("normalizeIntrinsicElementKey", () => {
	test.each([
		{ key: "className", expected: "class" },
		{ key: "htmlFor", expected: "for" },
		{ key: "crossOrigin", expected: "crossorigin" },
		{ key: "httpEquiv", expected: "http-equiv" },
		{ key: "itemProp", expected: "itemprop" },
		{ key: "fetchPriority", expected: "fetchpriority" },
		{ key: "noModule", expected: "nomodule" },
		{ key: "formAction", expected: "formaction" },
		{ key: "href", expected: "href" },
	])("should convert $key to $expected", ({ key, expected }) => {
		expect(normalizeIntrinsicElementKey(key)).toBe(expected);
	});
});

describe("styleObjectForEach", () => {
	describe("Should output the number as it is, when a number type is passed", () => {
		test.each([
			{ property: "animationIterationCount" },
			{ property: "aspectRatio" },
			{ property: "borderImageOutset" },
			{ property: "borderImageSlice" },
			{ property: "borderImageWidth" },
			{ property: "columnCount" },
			{ property: "columns" },
			{ property: "flex" },
			{ property: "flexGrow" },
			{ property: "flexPositive" },
			{ property: "flexShrink" },
			{ property: "flexNegative" },
			{ property: "flexOrder" },
			{ property: "gridArea" },
			{ property: "gridRow" },
			{ property: "gridRowEnd" },
			{ property: "gridRowSpan" },
			{ property: "gridRowStart" },
			{ property: "gridColumn" },
			{ property: "gridColumnEnd" },
			{ property: "gridColumnSpan" },
			{ property: "gridColumnStart" },
			{ property: "fontWeight" },
			{ property: "lineClamp" },
			{ property: "lineHeight" },
			{ property: "opacity" },
			{ property: "order" },
			{ property: "orphans" },
			{ property: "scale" },
			{ property: "tabSize" },
			{ property: "widows" },
			{ property: "zIndex" },
			{ property: "zoom" },
			{ property: "fillOpacity" },
			{ property: "floodOpacity" },
			{ property: "stopOpacity" },
			{ property: "strokeDasharray" },
			{ property: "strokeDashoffset" },
			{ property: "strokeMiterlimit" },
			{ property: "strokeOpacity" },
			{ property: "strokeWidth" },
		])("$property", ({ property }) => {
			const fn = mock();
			styleObjectForEach({ [property]: 1 }, fn);
			expect(fn).toHaveBeenCalledWith(
				property.replace(/[A-Z]/g, (m: string) => `-${m.toLowerCase()}`),
				"1",
			);
		});
	});
	describe("Should output with px suffix, when a number type is passed", () => {
		test.each([
			{ property: "borderBottomWidth" },
			{ property: "borderLeftWidth" },
			{ property: "borderRightWidth" },
			{ property: "borderTopWidth" },
			{ property: "borderWidth" },
			{ property: "bottom" },
			{ property: "fontSize" },
			{ property: "height" },
			{ property: "left" },
			{ property: "margin" },
			{ property: "marginBottom" },
			{ property: "marginLeft" },
			{ property: "marginRight" },
			{ property: "marginTop" },
			{ property: "padding" },
			{ property: "paddingBottom" },
			{ property: "paddingLeft" },
			{ property: "paddingRight" },
			{ property: "paddingTop" },
			{ property: "right" },
			{ property: "top" },
			{ property: "width" },
		])("$property", ({ property }) => {
			const fn = mock();
			styleObjectForEach({ [property]: 1 }, fn);
			expect(fn).toHaveBeenCalledWith(
				property.replace(/[A-Z]/g, (m: string) => `-${m.toLowerCase()}`),
				"1px",
			);
		});
	});
});
