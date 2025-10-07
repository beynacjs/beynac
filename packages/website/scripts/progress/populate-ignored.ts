#!/usr/bin/env bun

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function main() {
  const laravelDir = join(import.meta.dir, "../../../../laravel");
  const featuresPath = join(laravelDir, "features.md");

  // Read current features.md
  const content = await readFile(featuresPath, "utf-8");
  const lines = content.split("\n");

  // Files to move to Ignored section
  const ignoredPatterns = [
    /^types\//, // IDE stub files
  ];

  const newLines: string[] = [];
  const ignoredFiles: string[] = [];
  let inUncategorised = false;
  let foundIgnoredSection = false;
  let ignoredSectionIndex = -1;

  // First pass: identify sections and collect files to ignore
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === "# Ignored") {
      foundIgnoredSection = true;
      ignoredSectionIndex = newLines.length;
      newLines.push(line);
      continue;
    }

    if (line === "# Uncategorised") {
      inUncategorised = true;
      newLines.push(line);
      continue;
    }

    if (line.startsWith("# ")) {
      inUncategorised = false;
    }

    // Check if this is a file line in Uncategorised section
    const match = line.match(/^\[\]\((.+)\)$/);
    if (match && inUncategorised) {
      const filePath = match[1];
      const shouldIgnore = ignoredPatterns.some((pattern) => pattern.test(filePath));

      if (shouldIgnore) {
        ignoredFiles.push(filePath);
        // Don't add to newLines - we'll remove it from Uncategorised
        continue;
      }
    }

    newLines.push(line);
  }

  // Insert ignored files after # Ignored header
  if (foundIgnoredSection && ignoredFiles.length > 0) {
    // Find insertion point (after # Ignored and any blank lines)
    let insertIndex = ignoredSectionIndex + 1;
    while (insertIndex < newLines.length && newLines[insertIndex].trim() === "") {
      insertIndex++;
    }

    // Add subsection
    const ignoredSection = [
      "",
      "## IDE stub files",
      "",
      ...ignoredFiles.sort().map((f) => `[](${f})`),
    ];

    newLines.splice(insertIndex, 0, ...ignoredSection);
  }

  await writeFile(featuresPath, newLines.join("\n"));
  console.log(`✅ Moved ${ignoredFiles.length} files to # Ignored section`);
}

void main();
