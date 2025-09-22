/** @jsxImportSource ./view */
// This file tests for the circular type reference issue in TSX files
import type { Content } from "./view/public-types";

// This SHOULD trigger error TS1062 but might not in .tsx files
export const testAsyncContent = async (): Promise<Content> => {
  return "test";
};

// Test with JSX
export const testAsyncContentWithJSX = async (): Promise<Content> => {
  return <div>test</div>;
};