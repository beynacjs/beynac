#!/usr/bin/env bun

import { Glob } from "bun";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFeaturesMarkdown, type Feature } from "./parse-features-md.js";
import { analyzeFile } from "./port-utils.js";

interface FileInfo {
  path: string; // Full filesystem path from repo root
  isDone: boolean;
  loc: number;
}

interface FeatureStats {
  feature: Feature;
  totalLoc: number;
  doneLoc: number;
  percent: number;
  status: "done" | "in-progress" | "not-started";
  fileInfos: FileInfo[];
  subStats: FeatureStats[];
}

// Recursively collect all file paths from a feature and its descendants
function collectAllFilePaths(
  stat: FeatureStats,
  collector: Set<string>,
  ignoredCollector?: Set<string>,
): void {
  // If this is an ignored feature, add to ignored collector instead
  if (stat.feature.isIgnored && ignoredCollector) {
    for (const fileInfo of stat.fileInfos) {
      ignoredCollector.add(fileInfo.path);
    }
    for (const subStat of stat.subStats) {
      collectAllFilePaths(subStat, ignoredCollector, ignoredCollector);
    }
  } else {
    // Normal feature: add to main collector
    for (const fileInfo of stat.fileInfos) {
      collector.add(fileInfo.path);
    }
    for (const subStat of stat.subStats) {
      collectAllFilePaths(subStat, collector, ignoredCollector);
    }
  }
}

// Calculate stats for a feature
async function calculateFeatureStats(
  feature: Feature,
  globalIgnoredFiles?: Set<string>,
): Promise<FeatureStats> {
  let totalLoc = 0;
  let doneLoc = 0;

  // Process subfeatures FIRST (bottom-up) to collect their files
  const subStats: FeatureStats[] = [];
  const subfeatureFiles = new Set<string>();
  const ignoredFiles = new Set<string>();

  for (const sub of feature.sub) {
    const subStat = await calculateFeatureStats(sub, globalIgnoredFiles);
    subStats.push(subStat);

    // Only add to stats if not ignored
    if (!sub.isIgnored) {
      totalLoc += subStat.totalLoc;
      doneLoc += subStat.doneLoc;
    }

    // Collect all files from this subfeature tree
    collectAllFilePaths(subStat, subfeatureFiles, ignoredFiles);
  }

  // Get this feature's direct files, excluding subfeature and ignored files
  const fileInfos: FileInfo[] = [];

  // Filter out files that belong to subfeatures or are globally ignored (implicit exclusion)
  const parentOnlyFiles = feature.files.filter(
    (file) =>
      !subfeatureFiles.has(file) &&
      !ignoredFiles.has(file) &&
      !(globalIgnoredFiles && globalIgnoredFiles.has(file)),
  );

  for (const file of parentOnlyFiles) {
    // File paths are relative to Laravel folder, need full path for analyzeFile
    const fullPath = join(import.meta.dir, "../../../../laravel", file);
    const stats = await analyzeFile(fullPath);
    totalLoc += stats.lines;
    if (stats.isDone) {
      doneLoc += stats.lines;
    }

    fileInfos.push({
      path: file, // Keep relative path for display
      isDone: stats.isDone,
      loc: stats.lines,
    });
  }

  const percent = totalLoc > 0 ? (doneLoc / totalLoc) * 100 : 0;
  const status = percent === 100 ? "done" : percent > 0 ? "in-progress" : "not-started";

  return {
    feature,
    totalLoc,
    doneLoc,
    percent,
    status,
    fileInfos,
    subStats,
  };
}

// Check for duplicate files and ensure all files are covered
// Returns error message if there are issues, null otherwise
async function checkFilesCoverage(stats: FeatureStats[]): Promise<string | null> {
  // Check for duplicate files between siblings (features at the same level)
  // This includes both feature-feature and feature-ignore overlaps
  // Parent-child duplicates are allowed due to implicit exclusion
  function checkSiblingDuplicates(siblings: FeatureStats[], parentPath: string[]): void {
    const fileToSibling = new Map<string, string>();

    for (const stat of siblings) {
      // Check this sibling's direct files against other siblings
      for (const fileInfo of stat.fileInfos) {
        const existing = fileToSibling.get(fileInfo.path);
        if (existing) {
          const path1 = [...parentPath, existing].join(" > ");
          const path2 = [...parentPath, stat.feature.name].join(" > ");
          const type1 = existing.includes("[IGNORE]") ? "ignore" : "feature";
          const type2 = stat.feature.isIgnored ? "ignore" : "feature";
          throw new Error(
            `Duplicate file between sibling ${type1} and ${type2}:\n` +
              `  ${type1 === "ignore" ? "Ignore" : "Feature"} 1: ${path1}\n` +
              `  ${type2 === "ignore" ? "Ignore" : "Feature"} 2: ${path2}\n` +
              `  File: ${fileInfo.path}`,
          );
        }
        const displayName = stat.feature.isIgnored
          ? `[IGNORE] ${stat.feature.name}`
          : stat.feature.name;
        fileToSibling.set(fileInfo.path, displayName);
      }

      // Recursively check this feature's children for sibling conflicts
      if (stat.subStats.length > 0) {
        checkSiblingDuplicates(stat.subStats, [...parentPath, stat.feature.name]);
      }
    }
  }

  // Check top-level features and recursively check their children
  checkSiblingDuplicates(stats, []);

  // Collect all non-ignored files for coverage checking and duplicate detection
  const fileToFeature = new Map<string, string>();
  const ignoredFiles = new Set<string>();
  const allFilesGlobal = new Map<string, string>(); // Track ALL files globally for duplicate detection

  function collectFiles(stat: FeatureStats, featurePath: string[]): void {
    const currentPath = featurePath.join(" > ");

    if (stat.feature.isIgnored) {
      // Collect ignored files separately
      for (const fileInfo of stat.fileInfos) {
        ignoredFiles.add(fileInfo.path);
        // Check for duplicates in ignored section too
        if (allFilesGlobal.has(fileInfo.path)) {
          throw new Error(
            `Duplicate file found:\n` +
              `  File: ${fileInfo.path}\n` +
              `  First occurrence: ${allFilesGlobal.get(fileInfo.path)}\n` +
              `  Second occurrence: ${currentPath}`,
          );
        }
        allFilesGlobal.set(fileInfo.path, currentPath);
      }
      for (const subStat of stat.subStats) {
        collectFiles(subStat, [...featurePath, subStat.feature.name]);
      }
    } else {
      // Collect feature files for coverage tracking
      for (const fileInfo of stat.fileInfos) {
        // Check for global duplicates
        if (allFilesGlobal.has(fileInfo.path)) {
          throw new Error(
            `Duplicate file found:\n` +
              `  File: ${fileInfo.path}\n` +
              `  First occurrence: ${allFilesGlobal.get(fileInfo.path)}\n` +
              `  Second occurrence: ${currentPath}`,
          );
        }
        allFilesGlobal.set(fileInfo.path, currentPath);
        fileToFeature.set(fileInfo.path, currentPath);
      }
      for (const subStat of stat.subStats) {
        collectFiles(subStat, [...featurePath, subStat.feature.name]);
      }
    }
  }

  for (const stat of stats) {
    collectFiles(stat, [stat.feature.name]);
  }

  // Scan Laravel folder for all actual PHP files
  const laravelDir = join(import.meta.dir, "../../../../laravel");
  const glob = new Glob("**/*.php");
  const actualFiles: string[] = [];
  for await (const file of glob.scan({ cwd: laravelDir })) {
    if (file.startsWith("src/") || file.startsWith("tests/")) {
      actualFiles.push(file);
    }
  }

  // Check if any files are missing from features.md
  const missingFiles: string[] = [];
  for (const file of actualFiles) {
    if (!fileToFeature.has(file) && !ignoredFiles.has(file)) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    return `Missing ${missingFiles.length} file(s) from features.md:\n${missingFiles
      .map((f) => `  - ${f}`)
      .join("\n")}`;
  }

  return null;
}

// Generate HTML row for a feature (skip ignored features)
function generateRow(stat: FeatureStats, level: number = 0): string {
  // Skip ignored features - they don't appear in the output
  if (stat.feature.isIgnored) {
    // But still process their children (in case there are nested features)
    let html = "";
    for (const sub of stat.subStats) {
      html += generateRow(sub, level);
    }
    return html;
  }

  const bgColor =
    stat.status === "done" ? "#d4edda" : stat.status === "in-progress" ? "#fff3cd" : "#e9ecef";

  const indent = "&nbsp;&nbsp;".repeat(level * 2);
  const locTitle = `${stat.doneLoc.toLocaleString()} of ${stat.totalLoc.toLocaleString()} LoC`;

  // Count done files (only direct files, not subfeature files)
  const doneFileCount = stat.fileInfos.filter((f) => f.isDone).length;
  const totalFileCount = stat.fileInfos.length;

  // Generate files list for details element
  const sortedFiles = [...stat.fileInfos].sort((a, b) => a.path.localeCompare(b.path));
  const filesList = sortedFiles
    .map((f) => {
      // File paths are now relative to Laravel folder (src/Illuminate/... or tests/...)
      // Remove src/Illuminate/ prefix for display
      const displayPath = f.path.replace(/^src\/Illuminate\//, "");
      if (f.isDone) {
        return `<li><s>${displayPath}</s></li>`;
      } else {
        return `<li>TODO: ${displayPath}</li>`;
      }
    })
    .join("");

  let html = `
    <tr style="background-color: ${bgColor}">
      <td><span class="sticky-cell-content">${indent}${stat.feature.name}</span></td>
      <td title="${locTitle}"><span class="sticky-cell-content">${stat.percent.toFixed(1)}%</span></td>
      <td>
        <details>
          <summary>${doneFileCount} of ${totalFileCount}</summary>
          <ul style="margin: 5px 0; padding-left: 20px;">
            ${filesList}
          </ul>
        </details>
      </td>
    </tr>`;

  for (const sub of stat.subStats) {
    html += generateRow(sub, level + 1);
  }

  return html;
}

// Main report generation
async function main() {
  console.log("📊 Generating progress report...");

  // Parse features from markdown (located in Laravel folder at repo root)
  const features = await parseFeaturesMarkdown(
    join(import.meta.dir, "../../../../laravel/features.md"),
  );

  // First pass: collect all ignored files globally
  const globalIgnoredFiles = new Set<string>();
  for (const feature of features) {
    if (feature.isIgnored) {
      for (const file of feature.files) {
        globalIgnoredFiles.add(file);
      }
    }
  }

  const allStats = await Promise.all(
    features.map((f) => calculateFeatureStats(f, globalIgnoredFiles)),
  );

  // Check for duplicates and coverage, but continue to generate report
  let coverageError: string | null = null;
  try {
    coverageError = await checkFilesCoverage(allStats);
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
    process.exit(1);
  }

  // Calculate overall stats (exclude ignored features)
  const totalLoc = allStats.reduce((sum, s) => (s.feature.isIgnored ? sum : sum + s.totalLoc), 0);
  const doneLoc = allStats.reduce((sum, s) => (s.feature.isIgnored ? sum : sum + s.doneLoc), 0);
  const overallPercent = totalLoc > 0 ? (doneLoc / totalLoc) * 100 : 0;

  // Generate HTML fragment (not full document)
  const htmlFragment = `<style>
  .progress-summary {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 5px;
    margin-bottom: 20px;
  }
  .progress-table {
    border-collapse: collapse;
    width: 100%;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .progress-table th, .progress-table td {
    border: 1px solid #dee2e6;
    padding: 10px;
    text-align: left;
    vertical-align: top;
  }
  .progress-table th {
    background-color: #343a40;
    color: white;
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .sticky-cell-content {
    position: sticky;
    top: 50px;
    display: inline-block;
    background-color: inherit;
  }
  .progress-table tr:hover {
    opacity: 0.8;
  }
  .progress-table td[title] {
    cursor: help;
  }
</style>

<div class="progress-summary">
  <p><strong>${overallPercent.toFixed(1)}%</strong> complete (${doneLoc.toLocaleString()} of ${totalLoc.toLocaleString()} LoC)</p>
</div>

<table class="progress-table">
  <thead>
    <tr>
      <th>Feature</th>
      <th>Lines ported</th>
      <th>Files ported</th>
    </tr>
  </thead>
  <tbody>
    ${allStats.map((s) => generateRow(s)).join("")}
  </tbody>
</table>

<p style="margin-top: 20px; color: #6c757d; font-size: 0.9em;">
  Generated: ${new Date().toLocaleString()} |
  Hover over cells to see detailed LoC counts
</p>`;

  await writeFile(join(import.meta.dir, "../../docs/progress-content.html"), htmlFragment);
  console.log("✅ Generated docs/progress-content.html");
  console.log(
    `📈 Overall: ${overallPercent.toFixed(1)}% (${doneLoc.toLocaleString()} of ${totalLoc.toLocaleString()} LoC)`,
  );

  // Exit with error code if there were coverage issues
  if (coverageError) {
    console.error("\n❌ Error:", coverageError);
    process.exit(1);
  }
}

void main();
