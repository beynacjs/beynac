/**
 * Converts various input types into a space-separated class string.
 * Optimized for server-side rendering with focus on readability and performance.
 */

export type ClassAttributeValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | Record<string, unknown>
  | ClassAttributeValue[];

/**
 * Combines multiple class values into a single space-separated string.
 *
 * @example
 * classAttribute("foo", { bar: true, baz: false }, ["qux"]) // "foo bar qux"
 * classAttribute("foo", null, undefined, { active: true }) // "foo active"
 * classAttribute(["a", ["b", "c"]], { d: 1, e: 0 }) // "a b c d"
 */
export function classAttribute(...inputs: ClassAttributeValue[]): string {
  let result = "";
  let needSpace = false;

  /**
   * Appends a value to the result buffer with proper spacing
   */
  function append(value: string): void {
    if (value) {
      if (needSpace) {
        result += " ";
      }
      result += value;
      needSpace = true;
    }
  }

  function processValue(value: ClassAttributeValue): void {
    if (!value) return;

    if (typeof value === "string") {
      append(value);
    } else if (typeof value === "number") {
      append(String(value));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        processValue(item);
      }
    } else if (typeof value === "object") {
      for (const [key, val] of Object.entries(value)) {
        if (val) {
          append(key);
        }
      }
    }
  }

  for (const input of inputs) {
    processValue(input);
  }

  return result;
}
