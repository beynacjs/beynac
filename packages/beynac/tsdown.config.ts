import { defineConfig } from "tsdown";
import { ENTRY_POINTS } from "./src/test-utils/entryPoints.ts";

const internalDeps = ["devalue"]

export default defineConfig({
  entry: ENTRY_POINTS,
  format: ["esm"],
  outDir: "dist",
  dts: {
    resolve: true,
  },
  clean: true,
  exports: true,
  external: (dep) => !internalDeps.includes(dep),
});
