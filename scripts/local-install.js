import { lstatSync, realpathSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";

console.log("Installing the module...");

// Get foundry instance path from argument
const foundryDataPath = process.argv[2];
if (!foundryDataPath) {
	if (process.env.npm_command === "install") {
		console.log("Skipping module installation during npm install.");
		process.exit(0);
	}

	console.error("Error: No foundry data path provided.");
	process.exit(1);
}

// Symlink module to the foundry instance
const targetPath = join(foundryDataPath, "modules", "fvtt-player-spotlight");
const sourcePath = join(import.meta.dirname, "..");
const expectedTarget = realpathSync(sourcePath);
let targetStats;
try {
	targetStats = lstatSync(targetPath);
} catch (error) {
	if (error.code !== "ENOENT") {
		throw error;
	}
}

let isCurrentLink = false;
if (targetStats?.isSymbolicLink()) {
	try {
		isCurrentLink = realpathSync(targetPath) === expectedTarget;
	} catch (error) {
		if (error.code !== "ENOENT" && error.code !== "ENOTDIR") {
			throw error;
		}
	}
	if (!isCurrentLink) {
		unlinkSync(targetPath);
	}
}

if (isCurrentLink) {
	console.log("Module already installed. Skipping installation.");
} else {
	symlinkSync(sourcePath, targetPath);
	console.log("Module installed successfully.");
}
