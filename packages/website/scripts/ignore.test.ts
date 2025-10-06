import { expect, test } from "bun:test";
import { feature, ignore } from "./port-utils.js";

test("ignore() creates a Feature with isIgnored flag", () => {
  const result = ignore("Test fixtures", "Fixtures/**");
  expect(result.isIgnored).toBe(true);
  expect(result.name).toBe("Test fixtures");
  expect(result.patterns).toEqual(["Fixtures/**"]);
});

test("feature() does not have isIgnored flag", () => {
  const result = feature("Cache", "Cache/**");
  expect(result.isIgnored).toBeUndefined();
});

test("ignore() supports nested subfeatures", () => {
  const result = ignore("Test fixtures", "Fixtures/**", feature("Sub feature", "Fixtures/Sub/**"));
  expect(result.isIgnored).toBe(true);
  expect(result.sub.length).toBe(1);
  expect(result.sub[0].name).toBe("Sub feature");
});

test("ignore() supports array of patterns", () => {
  const result = ignore("Multiple", ["Pattern1/**", "Pattern2/**"]);
  expect(result.patterns).toEqual(["Pattern1/**", "Pattern2/**"]);
  expect(result.isIgnored).toBe(true);
});
