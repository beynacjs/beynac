import type { SharedTestConfig } from "../driver-shared.test";
import { memoryStorage } from "./MemoryStorageDriver";

export const memoryStorageSharedTestConfig: SharedTestConfig = {
	name: memoryStorage.name,
	createEndpoint: () => memoryStorage(),
};
