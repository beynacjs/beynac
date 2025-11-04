import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "contracts/index": "src/contracts/index.ts",
    facades: "src/facades.ts",
    "integrations/next": "src/integrations/next.ts",
    "view/index": "src/view/index.ts",
    "view/jsx-runtime": "src/view/jsx-runtime.ts",
    "view/jsx-dev-runtime": "src/view/jsx-dev-runtime.ts",
    "http/index": "src/http/index.ts",
  },
  format: ["esm"],
  outDir: "dist",
  dts: {
    resolve: true,
  },
  clean: true,
  exports: true
});
