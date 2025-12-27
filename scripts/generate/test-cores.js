// test-cores.js
//
// Run FuseSoC sim target on all icechips cores
//
// Usage: node test-cores.js [--verbose] [--filter <pattern>]
// Example: node test-cores.js
// Example: node test-cores.js --verbose
// Example: node test-cores.js --filter 7416
//
// © 2025 Charles Benedict, Jr.

import { execSync } from 'child_process';
import url from 'url';
import path from 'path';

import { runFuseSoCSim, isFuseSoCAvailable } from './test-core.js';

/**
 * Get all icechips core names from FuseSoC
 * @returns {string[]} - Array of core names
 */
function getAllIceChipsCores() {
	try {
		const output = execSync('fusesoc list-cores', {
			encoding: 'utf8',
			stdio: 'pipe'
		});

		const cores = [];
		const lines = output.split('\n');

		for (const line of lines) {
			// Look for lines containing "icechips:ttl:"
			if (line.includes('icechips:ttl:')) {
				// Extract the core name (first column before spaces/colons)
				const match = line.match(/^(icechips:ttl:[^\s:]+)/);
				if (match) {
					cores.push(match[1]);
				}
			}
		}

		return cores.sort();
	} catch (error) {
		throw new Error(`Failed to list cores: ${error.message}`);
	}
}

/**
 * Filter cores by pattern
 * @param {string[]} cores - Array of core names
 * @param {string} pattern - Filter pattern (matches if core name contains pattern)
 * @returns {string[]} - Filtered array of core names
 */
function filterCores(cores, pattern) {
	if (!pattern) {
		return cores;
	}
	return cores.filter((core) => core.includes(pattern));
}

/**
 * Main function
 */
function main() {
	const args = process.argv.slice(2);
	const verbose = args.includes('--verbose') || args.includes('-v');
	
	// Check for filter option
	let filterPattern = null;
	const filterIndex = args.indexOf('--filter');
	if (filterIndex !== -1 && args[filterIndex + 1]) {
		filterPattern = args[filterIndex + 1];
	}

	// Check if fusesoc is available
	if (!isFuseSoCAvailable()) {
		console.error('Error: fusesoc command not found.');
		console.error('');
		console.error('Please install FuseSoC and ensure it is in your PATH.');
		console.error('FuseSoC can be installed with: pip install fusesoc');
		process.exit(1);
	}

	// Get all icechips cores
	let cores;
	try {
		cores = getAllIceChipsCores();
	} catch (error) {
		console.error(`Error: ${error.message}`);
		process.exit(1);
	}

	if (cores.length === 0) {
		console.error('Error: No icechips cores found.');
		console.error('Make sure core files are in the project root and fusesoc.conf is configured.');
		process.exit(1);
	}

	// Apply filter if specified
	if (filterPattern) {
		cores = filterCores(cores, filterPattern);
		if (cores.length === 0) {
			console.error(`Error: No cores match filter pattern: ${filterPattern}`);
			process.exit(1);
		}
	}

	console.log(`Found ${cores.length} icechips core(s) to test:`);
	if (verbose || cores.length <= 10) {
		cores.forEach((core) => console.log(`  ${core}`));
	} else {
		console.log(`  ${cores[0]} ... ${cores[cores.length - 1]}`);
	}
	console.log('');

	// Test each core
	let successCount = 0;
	let failureCount = 0;
	const failures = [];

	cores.forEach((coreName, index) => {
		const progress = `[${index + 1}/${cores.length}]`;
		
		if (verbose) {
			console.log(`${progress} Testing ${coreName}...`);
		} else {
			process.stdout.write(`${progress} ${coreName}... `);
		}

		const result = runFuseSoCSim(coreName, verbose);

		if (result.success) {
			successCount++;
			if (verbose) {
				console.log(`${progress} ✓ ${coreName}: ${result.message}`);
			} else {
				console.log('✓');
			}
		} else {
			failureCount++;
			failures.push({ coreName, message: result.message, output: result.output });
			if (verbose) {
				console.error(`${progress} ✗ ${coreName}: ${result.message}`);
				if (result.output) {
					console.error(result.output);
				}
			} else {
				console.log('✗');
			}
		}

		if (verbose) {
			console.log('');
		}
	});

	// Summary
	console.log('');
	console.log('Summary:');
	console.log(`  Total:   ${cores.length}`);
	console.log(`  Success: ${successCount}`);
	console.log(`  Failed:  ${failureCount}`);

	if (failures.length > 0) {
		console.log('');
		console.log('Failures:');
		failures.forEach(({ coreName, message }) => {
			console.error(`  ${coreName}: ${message}`);
		});
		process.exit(1);
	}

	console.log('');
	console.log('All cores passed!');
}

main();

