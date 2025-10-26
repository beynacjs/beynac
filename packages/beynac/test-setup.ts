import { afterEach, mock } from "bun:test";

// Restore all mocks after every test globally
afterEach(() => {
  mock.restore();
});
