import { describe, test } from "bun:test";
import { getNameFromFile, getNameFromRequest } from "./MetadataExtractor";

describe(getNameFromFile, () => {
	test.skip("extracts name from File object", () => {
		// const file = new File(["content"], "test.txt", { type: "text/plain" });
		// const name = getNameFromFile(file);
		// expect(name).toBe("test.txt");
	});

	test.skip("handles File with empty name", () => {
		// const file = new File(["content"], "");
		// const name = getNameFromFile(file);
		// expect(name).toBeUndefined();
	});
});

describe(getNameFromRequest, () => {
	test.skip("extracts from X-File-Name header", () => {
		// const request = new Request("http://example.com", {
		//   headers: { "X-File-Name": "test.txt" }
		// });
		// const name = getNameFromRequest(request);
		// expect(name).toBe("test.txt");
	});

	test.skip("extracts from Content-Disposition header", () => {
		// const request = new Request("http://example.com", {
		//   headers: { "Content-Disposition": 'attachment; filename="test.txt"' }
		// });
		// const name = getNameFromRequest(request);
		// expect(name).toBe("test.txt");
	});

	test.skip("header priority order - X-File-Name over Content-Disposition", () => {
		// const request = new Request("http://example.com", {
		//   headers: {
		//     "X-File-Name": "priority.txt",
		//     "Content-Disposition": 'attachment; filename="fallback.txt"'
		//   }
		// });
		// const name = getNameFromRequest(request);
		// expect(name).toBe("priority.txt");
	});

	test.skip("handles missing metadata gracefully", () => {
		// const request = new Request("http://example.com");
		// const name = getNameFromRequest(request);
		// expect(name).toBeUndefined();
	});

	test.skip("parses Content-Disposition with quoted filenames", () => {
		// const request = new Request("http://example.com", {
		//   headers: { "Content-Disposition": 'attachment; filename="my file.txt"' }
		// });
		// const name = getNameFromRequest(request);
		// expect(name).toBe("my file.txt");
	});

	test.skip("handles malformed headers without throwing", () => {
		// const request = new Request("http://example.com", {
		//   headers: { "Content-Disposition": "malformed" }
		// });
		// expect(() => getNameFromRequest(request)).not.toThrow();
	});
});
