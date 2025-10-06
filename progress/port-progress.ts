#!/usr/bin/env bun

import { join } from "node:path";
import {
	PHP_FOLDER,
	findPhpFiles,
	analyzeFile,
	type FileStats,
} from "../packages/website/scripts/port-utils.js";

async function main() {
	try {
		const args = process.argv.slice(2);
		let filterPath = args[0];

		// Only scan src and tests subdirectories within PHP_FOLDER
		const srcFiles = await findPhpFiles(join(PHP_FOLDER, "src")).catch(
			() => [],
		);
		const testFiles = await findPhpFiles(join(PHP_FOLDER, "tests")).catch(
			() => [],
		);
		let phpFiles = [...srcFiles, ...testFiles];

		// Filter files if argument provided
		if (filterPath) {
			// Remove the PHP_FOLDER prefix if it's included in the argument
			if (filterPath.startsWith(PHP_FOLDER + "/")) {
				filterPath = filterPath.substring(PHP_FOLDER.length + 1);
			} else if (filterPath.startsWith("./" + PHP_FOLDER + "/")) {
				filterPath = filterPath.substring(("./" + PHP_FOLDER + "/").length);
			}

			// Filter files that are in directories matching the filter name
			const filterName = filterPath.split("/").pop() || filterPath;
			const filteredFiles = phpFiles.filter((file) => {
				const parts = file.split("/");
				// Check if any directory in the path matches the filter name
				return parts.some((part, index) => {
					if (part === filterName) {
						// Ensure it's a directory (not the file name)
						return index < parts.length - 1;
					}
					return false;
				});
			});

			// Find all matching directories
			const matchingDirs = new Set<string>();
			filteredFiles.forEach((file) => {
				const parts = file.split("/");
				parts.forEach((part, index) => {
					if (part === filterName && index < parts.length - 1) {
						const dirPath = parts.slice(0, index + 1).join("/");
						matchingDirs.add(dirPath);
					}
				});
			});

			if (matchingDirs.size === 0) {
				console.error(
					`Error: No directories named "${filterName}" found in ${PHP_FOLDER}`,
				);
				process.exit(1);
			}

			// Show which directories are being included
			console.log(`📂 Including directories named "${filterName}":`);
			Array.from(matchingDirs)
				.sort()
				.forEach((dir) => {
					console.log(`    • ${dir}`);
				});
			console.log();

			phpFiles = filteredFiles;
		}

		if (phpFiles.length === 0) {
			console.log("No PHP files found in the specified directory.");
			return;
		}

		const fileStats = await Promise.all(phpFiles.map(analyzeFile));

		// Calculate totals
		const totalFiles = fileStats.length;
		const doneFiles = fileStats.filter((f) => f.isDone).length;

		const totalLines = fileStats.reduce((sum, f) => sum + f.lines, 0);
		const doneLines = fileStats
			.filter((f) => f.isDone)
			.reduce((sum, f) => sum + f.lines, 0);

		const totalFunctions = fileStats.reduce((sum, f) => sum + f.functions, 0);
		const doneFunctions = fileStats
			.filter((f) => f.isDone)
			.reduce((sum, f) => sum + f.functions, 0);

		// Calculate percentages
		const filesPercent = totalFiles > 0 ? (doneFiles / totalFiles) * 100 : 0;
		const functionsPercent =
			totalFunctions > 0 ? (doneFunctions / totalFunctions) * 100 : 0;
		const linesPercent = totalLines > 0 ? (doneLines / totalLines) * 100 : 0;

		// Print results
		if (filterPath) {
			console.log(`💪 Port progress for ${filterPath}:`);
		} else {
			console.log("💪 Port progress:");
		}
		console.log(
			`    ⊞ Files: ${doneFiles}/${totalFiles} (${filesPercent.toFixed(2)}%)`,
		);
		console.log(
			`    ƒ Functions: ${doneFunctions}/${totalFunctions} (${functionsPercent.toFixed(2)}%)`,
		);
		console.log(
			`    ≡ Lines: ${doneLines}/${totalLines} (${linesPercent.toFixed(2)}%)`,
		);

		// If filter provided, show individual file details
		if (filterPath) {
			console.log("\n📁 File details:");

			// Sort files: done files first, then by path
			const sortedStats = fileStats.sort((a, b) => {
				if (a.isDone !== b.isDone) return b.isDone ? 1 : -1;
				return a.path.localeCompare(b.path);
			});

			// Show done files
			const doneFileStats = sortedStats.filter((f) => f.isDone);
			console.log("\n✅ DONE:");
			if (doneFileStats.length > 0) {
				doneFileStats.forEach((stat) => {
					console.log(`    ${stat.path}: ƒ ${stat.functions}; ≡ ${stat.lines}`);
				});
			} else {
				console.log("    (none)");
			}

			// Show todo files
			const todoFileStats = sortedStats.filter((f) => !f.isDone);
			console.log("\n📝 TODO:");
			if (todoFileStats.length > 0) {
				todoFileStats.forEach((stat) => {
					console.log(`    ${stat.path}: ƒ ${stat.functions}; ≡ ${stat.lines}`);
				});
			} else {
				console.log("    (none)");
			}
		}
	} catch (error) {
		console.error("Error:", error);
		process.exit(1);
	}
}

void main();
