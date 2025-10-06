#!/usr/bin/env bun

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findSourceFiles, PHP_FOLDER } from "./port-utils.js";

async function generatePaths() {
  const PHP_BASE = join(PHP_FOLDER, "src/Illuminate");
  const TESTS_BASE = join(PHP_FOLDER, "tests");

  const pathSet = new Set<string>();

  // Add all src/Illuminate files (excluding fixtures)
  const srcFiles = await findSourceFiles(PHP_BASE);
  for (const file of srcFiles) {
    // Skip fixture files
    if (file.toLowerCase().includes("/fixtures/")) {
      continue;
    }

    const relative = file.replace(PHP_BASE + "/", "");
    pathSet.add(relative);

    // Add all parent directory paths
    const parts = relative.split("/");
    for (let i = 1; i < parts.length; i++) {
      pathSet.add(parts.slice(0, i).join("/") + "/");
    }
  }

  // Add all tests files with "tests/" prefix (excluding fixtures)
  const testFiles = await findSourceFiles(TESTS_BASE);
  for (const file of testFiles) {
    // Skip fixture files
    if (file.toLowerCase().includes("/fixtures/")) {
      continue;
    }

    const relative = file.replace(TESTS_BASE + "/", "");
    pathSet.add("tests/" + relative);

    // Add all parent directory paths
    const parts = relative.split("/");
    for (let i = 1; i < parts.length; i++) {
      pathSet.add("tests/" + parts.slice(0, i).join("/") + "/");
    }
  }
  // Add the tests/ root directory
  pathSet.add("tests/");

  // Generate single sorted array
  const sortedPaths = Array.from(pathSet).sort();
  const pathItems = sortedPaths.map((p) => `\t"${p}",`).join("\n");

  const code = `// AUTO-GENERATED - DO NOT EDIT
// Run: bun scripts/generate-paths.ts
// Source files are .php and .stub files under src/Illuminate/ and tests/

export const allLaravelPaths = [
${pathItems}
] as const;

export type LaravelPath = (typeof allLaravelPaths)[number];

// Allow any string while providing autocomplete for known paths
export type GlobPattern = LaravelPath | (string & {});
`;

  await writeFile(join(import.meta.dir, "paths.ts"), code);
  console.log(`✅ Generated paths.ts with ${sortedPaths.length} paths`);
}

void generatePaths();
