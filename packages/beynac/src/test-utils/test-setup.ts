import { afterEach, beforeEach, mock } from "bun:test";
import { mockPlatformPaths } from "../storage/path-operations";
import { resetAllMocks } from "../testing";

beforeEach(() => {
	mockPlatformPaths("require");
});
afterEach(() => {
	mock.restore();
	resetAllMocks();
});
