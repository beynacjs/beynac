import { afterEach, beforeEach, mock } from "bun:test";
import { mockPlatformPaths } from "../storage/path";
import { resetAllMocks } from "../testing";

beforeEach(() => {
	mockPlatformPaths("require");
});
afterEach(() => {
	mock.restore();
	resetAllMocks();
});
