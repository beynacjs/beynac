import { Glob } from "bun";

/**
 * Expand glob patterns to a list of matching files.
 * Patterns are processed in order, with later patterns overriding earlier ones.
 * Patterns starting with "!" are negations that exclude files.
 *
 * @param patterns - Array of glob patterns (e.g., ["**\/*.ts", "!**\/test.ts"])
 * @param allFiles - Array of all available files to match against
 * @returns Array of files that match the patterns
 * @throws Error if any non-negated pattern matches no files (likely a typo)
 */
export function expandGlobPatterns(patterns: string[], allFiles: readonly string[]): string[] {
  const matchedFiles = new Set<string>();
  const patternMatchCounts = new Map<string, number>();

  // For each file, test against all patterns in order
  for (const file of allFiles) {
    let included = false;

    for (const pattern of patterns) {
      const isNegation = pattern.startsWith("!");
      const globPattern = isNegation ? pattern.slice(1) : pattern;
      const glob = new Glob(globPattern);

      if (glob.match(file)) {
        // Track that this pattern matched at least one file
        const currentCount = patternMatchCounts.get(pattern) || 0;
        patternMatchCounts.set(pattern, currentCount + 1);

        included = !isNegation; // Later patterns override earlier ones
      }
    }

    if (included) {
      matchedFiles.add(file);
    }
  }

  // Validate: each non-negated pattern must match at least one file
  for (const pattern of patterns) {
    if (!pattern.startsWith("!")) {
      const matchCount = patternMatchCounts.get(pattern) || 0;
      if (matchCount === 0) {
        throw new Error(
          `Pattern "${pattern}" matched no files.\n` +
            `This likely indicates a typo in the glob pattern.`,
        );
      }
    }
  }

  return Array.from(matchedFiles);
}
