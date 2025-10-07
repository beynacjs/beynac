import { readFile } from "node:fs/promises";

export const DONE_MARKER = "// DONE";

export interface FileStats {
  path: string;
  isDone: boolean;
  lines: number;
  functions: number;
}

function removeComments(content: string): string {
  // Remove block comments /* ... */
  content = content.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments //... (but not our DONE marker)
  content = content.replace(/\/\/(?!.*DONE).*$/gm, "");
  return content;
}

export async function analyzeFile(filePath: string): Promise<FileStats> {
  const content = await readFile(filePath, "utf-8");
  const isDone = content.includes(DONE_MARKER);

  // Count functions after removing comments
  const cleanContent = removeComments(content);
  const functions = (cleanContent.match(/\b(function|class|interface)\b/g) || []).length;
  const lines = cleanContent.trim().split(/\s*\n\s*/g).length;

  return {
    path: filePath,
    isDone,
    lines,
    functions,
  };
}
