/**
 * Entry points for the beynac package.
 * Shared between tsdown build config and source validation tests.
 */
export const ENTRY_POINTS = {
	"container/index": "src/container/container-entry-point.ts",
	contracts: "src/contracts.ts",
	errors: "src/errors.ts",
	events: "src/events.ts",
	facades: "src/facades.ts",
	"helpers/hash": "src/helpers/hash/hash-entry-point.ts",
	"helpers/headers": "src/helpers/headers.ts",
	"helpers/str": "src/helpers/str/str-entry-point.ts",
	"helpers/time": "src/helpers/time.ts",
	"http/index": "src/http/http-entry-point.ts",
	index: "src/core/core-entry-point.ts",
	integrations: "src/integrations/integrations-entry-point.ts",
	"integrations/next": "src/integrations/next.ts",
	storage: "src/storage/storage-entry-point.ts",
	"testing/index": "src/testing/testing-entry-point.ts",
	"view/index": "src/view/view-entry-point.ts",
	"view/jsx-dev-runtime": "src/view/jsx-dev-runtime.ts",
	"view/jsx-runtime": "src/view/jsx-runtime.ts",
};
