import { expect, test } from "bun:test";
import { join } from "node:path";
import { parseFeaturesMarkdown } from "./parse-features-md.js";

test("all files should be categorized (no files in Uncategorised section)", async () => {
  const featuresPath = join(import.meta.dir, "../../../../laravel/features.md");
  const features = await parseFeaturesMarkdown(featuresPath);

  // Find the Uncategorised section
  const uncategorised = features.find((f) => f.name === "Uncategorised");

  // Collect all files in Uncategorised and its subsections
  function collectFiles(feature: (typeof features)[0]): string[] {
    const files = [...feature.files];
    for (const sub of feature.sub) {
      files.push(...collectFiles(sub));
    }
    return files;
  }

  const uncategorisedFiles = uncategorised ? collectFiles(uncategorised) : [];

  if (uncategorisedFiles.length > 0) {
    const fileList = uncategorisedFiles.slice(0, 20).join("\n  - ");
    const more =
      uncategorisedFiles.length > 20 ? `\n  ... and ${uncategorisedFiles.length - 20} more` : "";
    throw new Error(
      `Found ${uncategorisedFiles.length} uncategorised file(s) in features.md.\n` +
        `All files must be categorized into specific feature sections.\n\n` +
        `Files in Uncategorised section:\n  - ${fileList}${more}`,
    );
  }

  expect(uncategorisedFiles).toHaveLength(0);
});
