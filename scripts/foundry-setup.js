import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";

console.log("Setting up the module...");

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

if (existsSync(targetPath)) {
	// Remove existing directory if needed
	rmSync(targetPath, {
		recursive: true,
		force: true,
	});
}
mkdirSync(join(foundryDataPath, "modules"), { recursive: true });

symlinkSync(sourcePath, targetPath, "dir");
console.log("Module installed successfully.");
