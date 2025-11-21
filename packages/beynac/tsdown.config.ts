import { defineConfig } from "tsdown";
import { ENTRY_POINTS } from "./src/test-utils/entryPoints";

export default defineConfig({
  entry: ENTRY_POINTS,
  format: ["esm"],
  outDir: "dist",
  dts: {
    resolve: true,
  },
  clean: true,
  exports: true,
  noExternal: ["devalue"],
});
