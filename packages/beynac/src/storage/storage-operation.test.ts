import { describe, expect, test } from "bun:test";
import { InvalidPathError, StorageUnknownError } from "./storage-errors";
import { storageOperation } from "./storage-operation";

describe(storageOperation, () => {
	test("returns result when function succeeds", () => {
		const result = storageOperation("test operation", () => {
			return "success";
		});
		expect(result).toBe("success");
	});

	test("preserves StorageError instances unchanged", () => {
		const originalError = new InvalidPathError("/bad", "test reason");

		try {
			storageOperation("test operation", () => {
				throw originalError;
			});
			throw new Error("Should have thrown");
		} catch (error) {
			expect(error).toBe(originalError);
			expect(error).toBeInstanceOf(InvalidPathError);
		}
	});

	test("wraps non-StorageError Error in StorageFailureError", () => {
		const originalError = new Error("Something went wrong");

		try {
			storageOperation("write file", () => {
				throw originalError;
			});
			throw new Error("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(StorageUnknownError);
			const storageError = error as StorageUnknownError;
			expect(storageError.operation).toBe("write file");
			expect(storageError.cause).toBe(originalError);
		}
	});

	test("wraps non-Error throws in StorageFailureError", () => {
		try {
			storageOperation("test operation", () => {
				throw "string error";
			});
			throw new Error("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(StorageUnknownError);
			const storageError = error as StorageUnknownError;
			expect(storageError.operation).toBe("test operation");
			expect(storageError.cause).toBeInstanceOf(Error);
			expect(storageError.cause?.message).toBe("string error");
		}
	});

	test("returns result when async function succeeds", async () => {
		const result = await storageOperation("test operation", async () => {
			return "async success";
		});
		expect(result).toBe("async success");
	});

	test("handles promise rejections", async () => {
		const originalError = new Error("Rejected");

		try {
			await storageOperation("async operation", () => Promise.reject(originalError));
			throw new Error("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(StorageUnknownError);
			expect((error as StorageUnknownError).operation).toBe("async operation");
			expect((error as StorageUnknownError).cause).toBe(originalError);
		}
	});
});
