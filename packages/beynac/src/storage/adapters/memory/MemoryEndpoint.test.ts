import type { SharedTestConfig } from "../../storage-test-utils";
import { MemoryEndpoint } from "./MemoryEndpoint";
import { memoryStorage } from "./memoryStorage";

export const memoryStorageSharedTestConfig: SharedTestConfig = {
	name: memoryStorage.name,
	createEndpoint: () => new MemoryEndpoint({}),
};
