// test-core.js
//
// Run FuseSoC sim target on a core
//
// Usage: node test-core.js <core-name> [options]
// Example: node test-core.js icechips:ttl:74161:0.9.2
// Example: node test-core.js 74161
// Example: node test-core.js 74161 --verbose
//
// © 2025 Charles Benedict, Jr.

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import url from 'url';

import { getVersionFromPackageJson } from './generate-core.js';

/**
 * Check if fusesoc command is available
 * @returns {boolean} - True if fusesoc is available
 */
export function isFuseSoCAvailable() {
	try {
		execSync('which fusesoc', { stdio: 'ignore' });
		return true;
	} catch (error) {
		return false;
	}
}

/**
 * Get full core name from chip number
 * @param {string} chipNumber - Chip number (e.g., "74161")
 * @param {string} projectRoot - Absolute path to project root
 * @returns {string} - Full core name (e.g., "icechips:ttl:74161:0.9.2")
 */
function getFullCoreName(chipNumber, projectRoot) {
	const version = getVersionFromPackageJson(projectRoot);
	return `icechips:ttl:${chipNumber}:${version}`;
}

/**
 * Check if a core file exists for the given chip number
 * @param {string} chipNumber - Chip number (e.g., "74161")
 * @param {string} projectRoot - Absolute path to project root
 * @returns {boolean} - True if core file exists
 */
function coreFileExists(chipNumber, projectRoot) {
	const coreFileName = `icechips_${chipNumber}.core`;
	const coreFilePath = path.join(projectRoot, coreFileName);
	return fs.existsSync(coreFilePath);
}

/**
 * Parse core name - accepts full name or chip number
 * @param {string} input - Core name or chip number
 * @param {string} projectRoot - Absolute path to project root
 * @returns {string} - Full core name
 */
function parseCoreName(input, projectRoot) {
	// If it looks like a full core name (contains colons), use it as-is
	if (input.includes(':')) {
		return input;
	}

	// Otherwise, treat it as a chip number
	const chipNumber = input;
	
	// Check if core file exists
	if (!coreFileExists(chipNumber, projectRoot)) {
		throw new Error(
			`Core file not found for chip ${chipNumber}. ` +
			`Expected: icechips_${chipNumber}.core`
		);
	}

	return getFullCoreName(chipNumber, projectRoot);
}

/**
 * Run FuseSoC sim target
 * @param {string} coreName - Full core name
 * @param {boolean} verbose - Whether to show verbose output
 * @returns {Object} - Result object with success flag and output
 */
export function runFuseSoCSim(coreName, verbose = false) {
	try {
		const command = `fusesoc run --target=sim ${coreName}`;
		
		if (verbose) {
			console.log(`Running: ${command}`);
		}

		const output = execSync(command, {
			encoding: 'utf8',
			stdio: verbose ? 'inherit' : 'pipe'
		});

		return {
			success: true,
			output: verbose ? undefined : output,
			message: `Simulation completed successfully for ${coreName}`
		};
	} catch (error) {
		return {
			success: false,
			output: error.stdout || error.stderr || error.message,
			message: `Simulation failed for ${coreName}: ${error.message}`
		};
	}
}

/**
 * Main function
 */
function main() {
	const args = process.argv.slice(2);

	if (args.length < 1) {
		console.error('Usage: node test-core.js <core-name> [--verbose]');
		console.error('  <core-name> can be:');
		console.error('    - Full core name: icechips:ttl:74161:0.9.2');
		console.error('    - Chip number: 74161');
		console.error('');
		console.error('Example: node test-core.js 74161');
		console.error('Example: node test-core.js icechips:ttl:74161:0.9.2 --verbose');
		process.exit(1);
	}

	// Check if fusesoc is available
	if (!isFuseSoCAvailable()) {
		console.error('Error: fusesoc command not found.');
		console.error('');
		console.error('Please install FuseSoC and ensure it is in your PATH.');
		console.error('FuseSoC can be installed with: pip install fusesoc');
		process.exit(1);
	}

	// Get project root directory
	const thisFilePath = url.fileURLToPath(import.meta.url);
	const thisDirectory = path.dirname(thisFilePath);
	const projectRoot = path.resolve(thisDirectory, '../../');

	// Parse arguments
	const coreNameInput = args[0];
	const verbose = args.includes('--verbose') || args.includes('-v');

	// Parse core name
	let coreName;
	try {
		coreName = parseCoreName(coreNameInput, projectRoot);
	} catch (error) {
		console.error(`Error: ${error.message}`);
		process.exit(1);
	}

	if (verbose) {
		console.log(`Core name: ${coreName}`);
		console.log('');
	}

	// Run simulation
	const result = runFuseSoCSim(coreName, verbose);

	if (result.success) {
		if (!verbose && result.output) {
			console.log(result.output);
		}
		console.log(result.message);
		process.exit(0);
	} else {
		console.error(result.message);
		if (result.output) {
			console.error('');
			console.error('Output:');
			console.error(result.output);
		}
		process.exit(1);
	}
}

// Only run main if this is the entry point (not imported as a module)
try {
	const scriptPath = process.argv[1];
	if (scriptPath) {
		const scriptUrl = url.pathToFileURL(scriptPath).href;
		if (import.meta.url === scriptUrl || scriptPath.endsWith('test-core.js')) {
			main();
		}
	}
} catch (error) {
	// If we can't determine, assume it's being imported (don't run main)
}

