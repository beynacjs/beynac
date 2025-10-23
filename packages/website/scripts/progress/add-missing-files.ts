#!/usr/bin/env bun

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Glob } from "bun";

async function main() {
  const laravelDir = join(import.meta.dir, "../../../../laravel");
  const featuresPath = join(laravelDir, "features.md");

  // Read current features.md
  const content = await readFile(featuresPath, "utf-8");
  const lines = content.split("\n");

  // Collect all files currently listed
  const listedFiles = new Set<string>();
  for (const line of lines) {
    const match = line.match(/^\[\]\((.+)\)$/);
    if (match) {
      listedFiles.add(match[1]);
    }
  }

  // Scan Laravel folder for all actual PHP files
  const glob = new Glob("**/*.php");
  const actualFiles: string[] = [];
  for await (const file of glob.scan({ cwd: laravelDir })) {
    if (!file.startsWith("vendor/")) {
      actualFiles.push(file);
    }
  }

  // Find missing files
  const missingFiles = actualFiles.filter((f) => !listedFiles.has(f)).sort();

  console.log(`Found ${missingFiles.length} missing files`);

  // Check if Uncategorised section already exists
  const hasUncategorised = content.includes("# Uncategorised");
  const hasIgnored = content.includes("# Ignored");

  let newContent = content.trimEnd() + "\n\n";

  // Add Ignored section if it doesn't exist (empty for now)
  if (!hasIgnored) {
    newContent += "# Ignored\n\n";
    console.log("Added empty # Ignored section");
  }

  // Add Uncategorised section with all missing files
  if (!hasUncategorised) {
    newContent += "# Uncategorised\n\n";
    for (const file of missingFiles) {
      newContent += `[](${file})\n`;
    }
    console.log(`Added # Uncategorised section with ${missingFiles.length} files`);
  } else {
    console.log("# Uncategorised section already exists");
  }

  await writeFile(featuresPath, newContent);
  console.log("✅ Updated features.md");
}

void main();
