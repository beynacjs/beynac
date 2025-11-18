import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "contracts": "src/contracts.ts",
    "facades": "src/facades.ts",
    "helpers/hash": "src/helpers/hash/index.ts",
    "helpers/headers": "src/helpers/headers.ts",
    "helpers/str": "src/helpers/str/index.ts",
    "helpers/time": "src/helpers/time.ts",
    "http/index": "src/http/index.ts",
    "index": "src/index.ts",
    "integrations/next": "src/integrations/next.ts",
    "storage": "src/storage/index.ts",
    "view/index": "src/view/index.ts",
    "view/jsx-dev-runtime": "src/view/jsx-dev-runtime.ts",
    "view/jsx-runtime": "src/view/jsx-runtime.ts",
  },
  format: ["esm"],
  outDir: "dist",
  dts: {
    resolve: true,
  },
  clean: true,
  exports: true,
  noExternal: ["devalue"],
});
