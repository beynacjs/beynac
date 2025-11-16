import type { SharedTestConfig } from "../../storage-test-utils";
import { MemoryStorageEndpoint } from "./MemoryStorageEndpoint";
import { memoryStorage } from "./memoryStorage";

export const memoryStorageSharedTestConfig: SharedTestConfig = {
	name: memoryStorage.name,
	createEndpoint: () => new MemoryStorageEndpoint({}),
};
