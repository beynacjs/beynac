import { describe, expect, spyOn, test } from "bun:test";

/**
 * Sanity check to ensure global mock cleanup is working.
 *
 * If the second test fails, it means mock.restore() is not being called
 * after each test, which indicates the global test setup is missing or broken.
 */
describe("mock cleanup sanity check", () => {
  const testObject = {
    method() {
      return "original";
    },
  };

  test("first test: creates a mock", () => {
    const spy = spyOn(testObject, "method");
    spy.mockReturnValue("mocked");

    expect(testObject.method()).toBe("mocked");
  });

  test("second test: mock should be cleaned up from previous test", () => {
    // If global mock.restore() is working, this should return "original"
    // If it returns "mocked", the mock wasn't cleaned up
    expect(testObject.method()).toBe("original");
  });
});
