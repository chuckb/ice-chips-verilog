// generate-cores.js
//
// Generate FuseSoC core files for all TTL chips in source-7400 directory
//
// Usage: node generate-cores.js [version]
// Example: node generate-cores.js
// Example: node generate-cores.js 0.9.2
//
// © 2025 Charles Benedict, Jr.

import fs from 'fs';
import path from 'path';
import url from 'url';

import { generateCoreForChip } from './generate-core.js';

/**
 * Extract chip number from file name
 * @param {string} fileName - File name (e.g., "74161.v")
 * @returns {string|null} - Chip number or null if not a valid chip file
 */
function extractChipNumber(fileName) {
	// Match files like "74161.v" but not "74161-tb.v"
	const chipFileRegex = /^([0-9]+)\.v$/;
	const match = fileName.match(chipFileRegex);
	if (match) {
		// Exclude testbench files (already filtered, but double-check)
		if (!fileName.includes('-tb')) {
			return match[1];
		}
	}
	return null;
}

/**
 * Get all chip numbers from source-7400 directory
 * @param {string} sourceDir - Absolute path to source-7400 directory
 * @returns {string[]} - Array of chip numbers
 */
function getAllChipNumbers(sourceDir) {
	const files = fs.readdirSync(sourceDir);
	const chipNumbers = new Set();

	files.forEach((fileName) => {
		// Only process .v files that are not testbench files
		if (fileName.endsWith('.v') && !fileName.includes('-tb.v')) {
			const chipNumber = extractChipNumber(fileName);
			if (chipNumber) {
				chipNumbers.add(chipNumber);
			}
		}
	});

	return Array.from(chipNumbers).sort();
}

/**
 * Main function
 */
function main() {
	const args = process.argv.slice(2);
	const version = args[0] || null;

	// Get project root directory
	const thisFilePath = url.fileURLToPath(import.meta.url);
	const thisDirectory = path.dirname(thisFilePath);
	const projectRoot = path.resolve(thisDirectory, '../../');

	// Get source directory
	const sourceDir = path.join(projectRoot, 'source-7400');

	// Check if source directory exists
	if (!fs.existsSync(sourceDir)) {
		console.error(`Error: Source directory not found: ${sourceDir}`);
		process.exit(1);
	}

	// Get all chip numbers
	const chipNumbers = getAllChipNumbers(sourceDir);

	if (chipNumbers.length === 0) {
		console.error('Error: No chip files found in source-7400 directory');
		process.exit(1);
	}

	console.log(`Found ${chipNumbers.length} chips to process:`);
	console.log(chipNumbers.join(', '));
	console.log('');

	// Process each chip
	let successCount = 0;
	let failureCount = 0;
	const failures = [];

	chipNumbers.forEach((chipNumber) => {
		const result = generateCoreForChip(chipNumber, projectRoot, version);
		if (result.success) {
			successCount++;
			console.log(`✓ ${chipNumber}: ${result.message}`);
		} else {
			failureCount++;
			failures.push({ chipNumber, message: result.message });
			console.error(`✗ ${chipNumber}: ${result.message}`);
		}
	});

	// Summary
	console.log('');
	console.log('Summary:');
	console.log(`  Success: ${successCount}`);
	console.log(`  Failed:  ${failureCount}`);

	if (failures.length > 0) {
		console.log('');
		console.log('Failures:');
		failures.forEach(({ chipNumber, message }) => {
			console.error(`  ${chipNumber}: ${message}`);
		});
		process.exit(1);
	}
}

main();

