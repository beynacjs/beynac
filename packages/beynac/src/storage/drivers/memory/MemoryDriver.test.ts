import { StorageImpl } from "../../StorageImpl";
import { defineDriverTests } from "../driver-test-utils";
import { memoryDriver } from "./MemoryDriver";

defineDriverTests(() => {
	const storage = new StorageImpl({
		disks: { test: memoryDriver({}) },
	});
	return storage.disk("test");
});
