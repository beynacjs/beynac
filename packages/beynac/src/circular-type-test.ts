// This file tests for the circular type reference issue
import type { Content } from "./view/public-types";

// This MUST trigger error TS1062: Type is referenced directly or indirectly
// in the fulfillment callback of its own 'then' method
export const testAsyncContent = async (): Promise<Content> => {
  return "test";
};

// If this file doesn't cause a TypeScript error, then the Content type
// has a circular reference that VS Code detects but tsc doesn't
