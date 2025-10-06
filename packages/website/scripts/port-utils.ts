import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { GlobPattern } from "./paths.js";

export const PHP_FOLDER = "../../laravel";
export const DONE_MARKER = "// DONE";

export interface FileStats {
  path: string;
  isDone: boolean;
  lines: number;
  functions: number;
}

export async function findSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findSourceFiles(fullPath)));
    } else if (entry.isFile() && (entry.name.endsWith(".php") || entry.name.endsWith(".stub"))) {
      files.push(fullPath);
    }
  }

  return files;
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

export type Feature = {
  name: string;
  patterns: string[];
  sub: Feature[];
  isIgnored?: boolean;
};

export function feature(
  name: string,
  patterns: GlobPattern | GlobPattern[] = [],
  ...subfeatures: Feature[]
): Feature {
  return {
    name,
    patterns: Array.isArray(patterns) ? patterns : patterns ? [patterns] : [],
    sub: subfeatures,
  };
}

export function ignore(
  name: string,
  patterns: GlobPattern | GlobPattern[] = [],
  ...subfeatures: Feature[]
): Feature {
  return {
    name,
    patterns: Array.isArray(patterns) ? patterns : patterns ? [patterns] : [],
    sub: subfeatures,
    isIgnored: true,
  };
}
