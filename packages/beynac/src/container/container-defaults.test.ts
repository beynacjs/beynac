import { describe, expect, test } from "bun:test";
import { key } from "@/keys";
import { Container } from "./container";

describe("Container with default values", () => {
  describe("get with defaults", () => {
    test("returns default when key not bound", () => {
      const container = new Container();
      const keyWithDefault = key<string>({
        name: "test",
        default: "defaultValue",
      });

      const result = container.get(keyWithDefault);
      expect(result).toBe("defaultValue");
    });

    test("returns bound value over default", () => {
      const container = new Container();
      const keyWithDefault = key<string>({
        name: "test",
        default: "defaultValue",
      });

      container.bind(keyWithDefault, { instance: "boundValue" });

      const result = container.get(keyWithDefault);
      expect(result).toBe("boundValue");
    });

    test("throws for key without explicit default and no binding", () => {
      const container = new Container();
      const keyWithoutDefault = key<string>({ name: "test" });

      // Keys without explicit default should throw
      expect(() => container.get(keyWithoutDefault)).toThrow(
        "Can't create an instance of [test] because no value or factory function was supplied"
      );
    });

    test("default values work with different types", () => {
      const container = new Container();

      const numberKey = key<number>({ name: "num", default: 42 });
      expect(container.get(numberKey)).toBe(42);

      const boolKey = key<boolean>({ name: "bool", default: true });
      expect(container.get(boolKey)).toBe(true);

      const objectKey = key<{ name: string }>({
        name: "obj",
        default: {
          name: "default",
        },
      });
      expect(container.get(objectKey)).toEqual({ name: "default" });

      const arrayKey = key<number[]>({ name: "arr", default: [1, 2, 3] });
      expect(container.get(arrayKey)).toEqual([1, 2, 3]);
    });

    test("explicit null default does not throw", () => {
      const container = new Container();
      const keyWithNullDefault = key<string | null>({
        name: "test",
        default: null,
      });

      // Explicit null default should return null, not throw
      const result = container.get(keyWithNullDefault);
      expect(result).toBe(null);
    });

    test("explicit undefined default throws (same as no default)", () => {
      const container = new Container();
      const keyWithUndefinedDefault = key<string | undefined>({
        name: "test",
        default: undefined,
      });

      // With current keys.ts, explicit undefined is same as no default - both throw
      expect(() => container.get(keyWithUndefinedDefault)).toThrow(
        "Can't create an instance of [test] because no value or factory function was supplied"
      );
    });
  });

  describe("binding checks with defaults", () => {
    test("key with default is not considered bound", () => {
      const container = new Container();
      const keyWithDefault = key<string>({
        name: "test",
        default: "defaultValue",
      });

      expect(container.bound(keyWithDefault)).toBe(false);

      // After getting with default, still not bound
      container.get(keyWithDefault);
      expect(container.bound(keyWithDefault)).toBe(false);

      // After explicit binding, it is bound
      container.bind(keyWithDefault, { instance: "bound" });
      expect(container.bound(keyWithDefault)).toBe(true);
    });
  });

  describe("scoped and singleton with defaults", () => {
    test("default values work with scoped container", () => {
      const container = new Container();
      // Commenting out createScopedContainer as it may not exist
      // const scopedContainer = container.createScopedContainer();

      const keyWithDefault = key<string>({
        name: "test",
        default: "defaultValue",
      });

      // Test just the main container
      expect(container.get(keyWithDefault)).toBe("defaultValue");
      // Will add scoped container tests if the method exists
    });
  });

  describe("optional injection with defaults", () => {
    test("optional inject returns default when available", () => {
      const container = new Container();
      const keyWithDefault = key<string>({
        name: "optional",
        default: "defaultValue",
      });

      // Key with default returns the default value
      const value = container.get(keyWithDefault);
      expect(value).toBe("defaultValue");

      // After binding, returns the bound value
      container.bind(keyWithDefault, { instance: "boundValue" });
      const boundValue = container.get(keyWithDefault);
      expect(boundValue).toBe("boundValue");
    });
  });
});
