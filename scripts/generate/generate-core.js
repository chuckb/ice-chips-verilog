// generate-core.js
//
// Generate FuseSoC core files for TTL chips
//
// Usage: node generate-core.js <chip-number> [version]
// Example: node generate-core.js 74161
// Example: node generate-core.js 74161 0.9.2
//
// © 2025 Charles Benedict, Jr.

import fs from 'fs';
import path from 'path';
import url from 'url';

import { FsReadFileHelper } from '../common/fs-file-helper.js';
import { FsPathHelper } from '../common/fs-path-helper.js';
import { EOL } from '../common/constants.js';

/**
 * Extract module name from Verilog file content
 * @param {string} verilogContent - The content of the Verilog file
 * @returns {string|null} - The module name or null if not found
 */
export function extractModuleName(verilogContent) {
	// Match: module <name> (with optional parameters)
	// Handles: module ttl_74161 #(parameter ...)
	// Handles: module test;
	const moduleRegex = /^\s*module\s+(\w+)\s*(?:#|\(|;)/m;
	const match = verilogContent.match(moduleRegex);
	return match ? match[1] : null;
}

/**
 * Read version from package.json
 * @param {string} projectRoot - Absolute path to project root
 * @returns {string} - Version string
 */
export function getVersionFromPackageJson(projectRoot) {
	const packageJsonPath = path.join(projectRoot, 'package.json');
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
	return packageJson.version || '0.1.0';
}

/**
 * Generate FuseSoC core file content
 * @param {Object} config - Configuration object
 * @param {string} config.chipNumber - Chip number (e.g., "74161")
 * @param {string} config.version - Version string (e.g., "0.9.2")
 * @param {string} config.rtlModuleName - RTL module name (e.g., "ttl_74161")
 * @param {string} config.tbModuleName - Testbench module name (e.g., "test")
 * @returns {string} - Core file content
 */
export function generateCoreFile({ chipNumber, version, rtlModuleName, tbModuleName }) {
	const coreName = `icechips:ttl:${chipNumber}:${version}`;

	return `CAPI=2:
name: ${coreName}

# Note: File order matters for iverilog! RTL must come last because
# the testbench instantiates the DUT module, so the module must be
# defined before instantiation. Iverilog processes files sequentially
# and doesn't do multiple passes.
# Macro dependencies must also be defined first.

filesets:
  rtl:
    files:
      - includes/helper.v
      - source-7400/${chipNumber}.v
    file_type: verilogSource

  tb:
    files:
      - includes/tbhelper.v
      - source-7400/${chipNumber}-tb.v
    file_type: verilogSource

targets:
  default:
    filesets: [rtl]
    toplevel: ${rtlModuleName}
  sim:
    filesets: [tb, rtl]
    toplevel: ${tbModuleName}
    default_tool: icarus
    tools:
      icarus: {iverilog_options: [-g2012]}
`;
}

/**
 * Main function
 */
function main() {
	const args = process.argv.slice(2);

	if (args.length < 1) {
		console.error('Usage: node generate-core.js <chip-number> [version]');
		console.error('Example: node generate-core.js 74161');
		console.error('Example: node generate-core.js 74161 0.9.2');
		process.exit(1);
	}

	const chipNumber = args[0];
	const version = args[1] || null;

	// Get project root directory
	const thisFilePath = url.fileURLToPath(import.meta.url);
	const thisDirectory = path.dirname(thisFilePath);
	const projectRoot = path.resolve(thisDirectory, '../../');

	// Get version from package.json if not provided
	const finalVersion = version || getVersionFromPackageJson(projectRoot);

	// Setup file helpers
	const sourceDir = path.join(projectRoot, 'source-7400');
	const fsSource = new FsReadFileHelper(sourceDir);

	const rtlFileName = `${chipNumber}.v`;
	const tbFileName = `${chipNumber}-tb.v`;

	// Check if files exist
	if (!fsSource.isExistingFile(rtlFileName)) {
		console.error(`Error: RTL file not found: ${path.join(sourceDir, rtlFileName)}`);
		process.exit(1);
	}

	if (!fsSource.isExistingFile(tbFileName)) {
		console.error(`Error: Testbench file not found: ${path.join(sourceDir, tbFileName)}`);
		process.exit(1);
	}

	// Read and extract module names
	const rtlContent = fsSource.readFile(rtlFileName);
	const tbContent = fsSource.readFile(tbFileName);

	const rtlModuleName = extractModuleName(rtlContent);
	const tbModuleName = extractModuleName(tbContent);

	if (!rtlModuleName) {
		console.error(`Error: Could not extract module name from ${rtlFileName}`);
		process.exit(1);
	}

	if (!tbModuleName) {
		console.error(`Error: Could not extract module name from ${tbFileName}`);
		process.exit(1);
	}

	console.log(`Extracted RTL module name: ${rtlModuleName}`);
	console.log(`Extracted testbench module name: ${tbModuleName}`);

	// Generate core file content
	const coreContent = generateCoreFile({
		chipNumber,
		version: finalVersion,
		rtlModuleName,
		tbModuleName
	});

	// Write core file
	const coreFileName = `icechips_${chipNumber}.core`;
	const coreFilePath = path.join(projectRoot, coreFileName);

	fs.writeFileSync(coreFilePath, coreContent, 'utf8');

	console.log(`Generated core file: ${coreFilePath}`);
}

/**
 * Generate a core file for a single chip
 * @param {string} chipNumber - Chip number (e.g., "74161")
 * @param {string} projectRoot - Absolute path to project root
 * @param {string} version - Version string (optional, will read from package.json if not provided)
 * @returns {Object} - Result object with success flag and message
 */
export function generateCoreForChip(chipNumber, projectRoot, version = null) {
	try {
		// Get version from package.json if not provided
		const finalVersion = version || getVersionFromPackageJson(projectRoot);

		// Setup file helpers
		const sourceDir = path.join(projectRoot, 'source-7400');
		const fsSource = new FsReadFileHelper(sourceDir);

		const rtlFileName = `${chipNumber}.v`;
		const tbFileName = `${chipNumber}-tb.v`;

		// Check if files exist
		if (!fsSource.isExistingFile(rtlFileName)) {
			return {
				success: false,
				message: `RTL file not found: ${path.join(sourceDir, rtlFileName)}`
			};
		}

		if (!fsSource.isExistingFile(tbFileName)) {
			return {
				success: false,
				message: `Testbench file not found: ${path.join(sourceDir, tbFileName)}`
			};
		}

		// Read and extract module names
		const rtlContent = fsSource.readFile(rtlFileName);
		const tbContent = fsSource.readFile(tbFileName);

		const rtlModuleName = extractModuleName(rtlContent);
		const tbModuleName = extractModuleName(tbContent);

		if (!rtlModuleName) {
			return {
				success: false,
				message: `Could not extract module name from ${rtlFileName}`
			};
		}

		if (!tbModuleName) {
			return {
				success: false,
				message: `Could not extract module name from ${tbFileName}`
			};
		}

		// Generate core file content
		const coreContent = generateCoreFile({
			chipNumber,
			version: finalVersion,
			rtlModuleName,
			tbModuleName
		});

		// Write core file
		const coreFileName = `icechips_${chipNumber}.core`;
		const coreFilePath = path.join(projectRoot, coreFileName);

		fs.writeFileSync(coreFilePath, coreContent, 'utf8');

		return {
			success: true,
			message: `Generated core file: ${coreFilePath}`,
			chipNumber,
			rtlModuleName,
			tbModuleName
		};
	} catch (error) {
		return {
			success: false,
			message: `Error processing ${chipNumber}: ${error.message}`
		};
	}
}

// Only run main if this is the entry point (not imported as a module)
// Check if this file is being run directly by comparing the file URL
try {
	const scriptPath = process.argv[1];
	if (scriptPath) {
		const scriptUrl = url.pathToFileURL(scriptPath).href;
		if (import.meta.url === scriptUrl || scriptPath.endsWith('generate-core.js')) {
			main();
		}
	}
} catch (error) {
	// If we can't determine, assume it's being imported (don't run main)
}

