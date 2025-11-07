import { defineDriverIntegrationTests } from "../driver-integration.shared.test";
import { defineDriverUnitTests } from "../driver-unit-tests.shared.test";
import { memoryStorage } from "./MemoryStorageDriver";

defineDriverUnitTests(memoryStorage);
defineDriverIntegrationTests(memoryStorage);
