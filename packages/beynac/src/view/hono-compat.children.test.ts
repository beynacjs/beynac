// These tests are imported from the tmp-hono-view implementation for compatibility testing
// They may need modifications to work with the Beynac JSX implementation

import { describe, it } from "bun:test";

describe("Hono compatibility tests - Children", () => {
  describe("map", () => {
    it.skip("should map children", () => {
      // Children utility is not implemented in Beynac yet
      // const element = createElement("div", null, 1, 2, 3);
      // const result = Children.map(
      // 	element.children,
      // 	(child) => (child as number) * 2,
      // );
      // expect(result).toEqual([2, 4, 6]);
    });
  });

  describe("forEach", () => {
    it.skip("should iterate children", () => {
      // Children utility is not implemented in Beynac yet
      // const element = createElement("div", null, 1, 2, 3);
      // const result: number[] = [];
      // Children.forEach(element.children, (child) => {
      // 	result.push(child as number);
      // });
      // expect(result).toEqual([1, 2, 3]);
    });
  });

  describe("count", () => {
    it.skip("should count children", () => {
      // Children utility is not implemented in Beynac yet
      // const element = createElement("div", null, 1, 2, 3);
      // const result = Children.count(element.children);
      // expect(result).toBe(3);
    });
  });

  describe("only", () => {
    it.skip("should return the only child", () => {
      // Children utility is not implemented in Beynac yet
      // const element = createElement("div", null, 1);
      // const result = Children.only(element.children);
      // expect(result).toBe(1);
    });

    it.skip("should throw an error if there are multiple children", () => {
      // Children utility is not implemented in Beynac yet
      // const element = createElement("div", null, 1, 2);
      // expect(() => Children.only(element.children)).toThrowError(
      // 	"Children.only() expects only one child",
      // );
    });
  });

  describe("toArray", () => {
    it.skip("should convert children to an array", () => {
      // Children utility is not implemented in Beynac yet
      // const element = createElement("div", null, 1, 2, 3);
      // const result = Children.toArray(element.children);
      // expect(result).toEqual([1, 2, 3]);
    });
  });
});
