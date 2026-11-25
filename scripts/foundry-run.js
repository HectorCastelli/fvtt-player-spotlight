import { spawn } from "node:child_process";
import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "..");
const foundryEntry = join(repoRoot, "test", "local", "instance", "main.js");
const foundryProcess = spawn(
	process.execPath,
	[foundryEntry, "--dataPath=test/local/data", "--port=31234"],
	{
		cwd: repoRoot,
		stdio: "inherit",
	},
);

foundryProcess.once("error", (error) => {
	console.error(`Failed to start Foundry: ${error.message}`);
	process.exitCode = 1;
});

foundryProcess.once("close", (code) => {
	process.exitCode = code ?? 1;
});
