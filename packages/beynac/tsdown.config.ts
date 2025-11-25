import { defineConfig } from "tsdown";
import { ENTRY_POINTS } from "./src/test-utils/entryPoints.ts";

const bundledDeps = ["devalue", "@bradenmacdonald/s3-lite-client"];

export default defineConfig({
  entry: ENTRY_POINTS,
  format: ["esm"],
  outDir: "dist",
  dts: {
    resolve: true,
  },
  clean: true,
  external: (dep) => {
    // local source files are bundled
    if (dep.startsWith(".") || dep.startsWith("/")) return false;
    return !bundledDeps.includes(dep);
  },
});
