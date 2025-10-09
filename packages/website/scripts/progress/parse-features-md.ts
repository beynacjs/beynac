import { readFile } from "node:fs/promises";

export interface Feature {
  name: string;
  files: string[];
  sub: Feature[];
  isIgnored?: boolean;
}

export async function parseFeaturesMarkdown(filePath: string): Promise<Feature[]> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");

  const rootFeatures: Feature[] = [];
  const stack: { level: number; feature: Feature }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip blank lines
    if (line.trim() === "") {
      continue;
    }

    // Check if it's a header
    const headerMatch = line.match(/^(#+)\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const name = headerMatch[2];

      // Pop stack until we find the parent level
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      // Check if this feature should be ignored
      // A feature is ignored if:
      // 1. Its name contains "IGNORED" (case insensitive), OR
      // 2. It's a child of an ignored feature (inherited)
      const parentIsIgnored = stack.length > 0 && stack[stack.length - 1].feature.isIgnored;
      const isIgnored = name.toUpperCase().includes("IGNORED") || parentIsIgnored;

      const feature: Feature = {
        name,
        files: [],
        sub: [],
        isIgnored,
      };

      // Add to parent or root
      if (stack.length === 0) {
        rootFeatures.push(feature);
      } else {
        stack[stack.length - 1].feature.sub.push(feature);
      }

      // Push current feature onto stack
      stack.push({ level, feature });
    } else {
      // It's a file path - must be in format [](path)
      const linkMatch = line.match(/^\[\]\((.+)\)$/);
      if (!linkMatch) {
        throw new Error(
          `Invalid file path format at line ${lineNum}. Expected format: [](path)\nGot: ${line}`,
        );
      }

      const filePath = linkMatch[1];
      if (stack.length > 0) {
        stack[stack.length - 1].feature.files.push(filePath);
      } else {
        throw new Error(`File path at line ${lineNum} is not under any feature header: ${line}`);
      }
    }
  }

  return rootFeatures;
}
