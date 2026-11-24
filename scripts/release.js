import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { join } from "node:path";
import { inc, rsort, valid } from "semver";
import { simpleGit } from "simple-git";
import { bundle } from "./bundle.js";

const repoRoot = join(import.meta.dirname, "..");
const workingDirectory = repoRoot;
const git = simpleGit(workingDirectory);
const publishingGit = simpleGit(workingDirectory).outputHandler(
	(_command, stdout, stderr) => {
		stdout.pipe(process.stdout);
		stderr.pipe(process.stderr);
	},
);

console.log("Preparing release artifacts...");
const bumpType = process.argv[2];
if (!["major", "minor", "patch"].includes(bumpType)) {
	console.error("Version bump must be one of: major, minor, patch.");
	process.exit(1);
}

const remoteTags = await git.listRemote(["--tags", "--refs", "origin"]);
const versions = [];
for (const line of remoteTags.split(/\r?\n/)) {
	const tagName = line
		.trim()
		.split(/\s+/)
		.at(-1)
		?.replace(/^refs\/tags\//, "");
	const version = tagName ? valid(tagName) : null;
	if (version) {
		versions.push(version);
	}
}

const latestVersion = rsort(versions)[0];
if (!latestVersion) {
	throw new Error("No valid SemVer tags found on origin.");
}

const versionNumber = inc(latestVersion, bumpType);
if (!versionNumber) {
	throw new Error(`Could not apply ${bumpType} bump to ${latestVersion}.`);
}

console.log(
	`Releasing ${versionNumber} (${bumpType} bump from ${latestVersion})`,
);
console.log("Bundle release");
await bundle(versionNumber);

const changelogPath = join(workingDirectory, "dist", "CHANGELOG.md");
const changelog = fs.readFileSync(changelogPath, "utf8");

console.log("Creating annotated tag...");
await git.addAnnotatedTag(versionNumber, changelog.trimEnd());
await publishingGit.push();
await publishingGit.push(["--tags"]);

console.log("Creating GitHub release");
let releaseUrl;
try {
	releaseUrl = execFileSync(
		"gh",
		[
			"release",
			"create",
			versionNumber,
			"--latest",
			"--title",
			versionNumber,
			"--notes-file",
			"dist/CHANGELOG.md",
			"dist/module.zip",
			"dist/module.json",
		],
		{ cwd: workingDirectory, encoding: "utf8" },
	).trim();
} catch (error) {
	if (error.stderr) {
		process.stderr.write(error.stderr);
	}
	throw error;
}
console.log(`Created: ${releaseUrl}`);

console.log("Updating FoundryVTT Module submission");
const module = JSON.parse(
	fs.readFileSync(join(workingDirectory, "dist", "module.json"), "utf8"),
);
const foundryPayload = {
	id: module.id,
	release: {
		version: versionNumber,
		manifest: `https://github.com/HectorCastelli/fvtt-player-spotlight/releases/download/${versionNumber}/module.json`,
		notes: releaseUrl,
		compatibility: module.compatibility,
	},
};
const requestBody = JSON.stringify(foundryPayload);

try {
	process.loadEnvFile(join(repoRoot, ".env"));
} catch (error) {
	if (error.code !== "ENOENT") {
		throw error;
	}
}
const token = process.env.FOUNDRY_API_TOKEN;
if (!token) {
	console.error(
		"Unable to find FOUNDRY_API_TOKEN. FoundryVTT submission was not updated.",
	);
	process.exit(2);
}

const response = await fetch(
	"https://foundryvtt.com/_api/packages/release_version/",
	{
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: token,
		},
		body: requestBody,
	},
);
const responseBody = await response.text();
const responseJson = JSON.parse(responseBody);
if (responseJson.status !== "success") {
	console.error(
		`FoundryVTT package release failed with status: ${responseJson.status ?? "null"}`,
	);
	console.error(JSON.stringify(responseJson, null, 2));
	process.exit(3);
}
