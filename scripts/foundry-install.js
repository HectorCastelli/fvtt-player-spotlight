import { createWriteStream } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import yauzl from "yauzl";

const repoRoot = join(import.meta.dirname, "..");
const localDirectory = join(repoRoot, "test", "local");
const instancePath = join(localDirectory, "instance");
const modulePath = join(repoRoot, "module.json");

function getFoundryVersion(foundryPackage) {
	const { generation, build } = foundryPackage.release ?? {};
	if (Number.isInteger(generation) && Number.isInteger(build)) {
		return `${generation}.${build}`;
	}

	const match =
		typeof foundryPackage.version === "string" &&
		foundryPackage.version.match(/^(\d+\.\d+)(?:\.\d+)?(?:[-+].*)?$/);
	return match?.[1];
}

async function readInstanceVersion(packagePath) {
	try {
		const packageContents = await readFile(packagePath, "utf8");
		return getFoundryVersion(JSON.parse(packageContents));
	} catch (error) {
		if (error.code === "ENOENT") {
			return undefined;
		}
		throw error;
	}
}

function extractZip(archivePath, destination) {
	const extractionRoot = resolve(destination);
	return new Promise((resolveExtraction, rejectExtraction) => {
		yauzl.open(
			archivePath,
			{ lazyEntries: true, strictFileNames: true },
			(error, zipfile) => {
				if (error) {
					rejectExtraction(error);
					return;
				}

				let settled = false;
				const fail = (failure) => {
					if (settled) return;
					settled = true;
					zipfile.close();
					rejectExtraction(failure);
				};

				zipfile.on("error", fail);
				zipfile.once("end", () => {
					if (settled) return;
					settled = true;
					resolveExtraction();
				});
				zipfile.on("entry", (entry) => {
					void (async () => {
						const outputPath = resolve(extractionRoot, entry.fileName);
						const outputRelativePath = relative(extractionRoot, outputPath);
						if (
							outputRelativePath === ".." ||
							outputRelativePath.startsWith(`..${sep}`) ||
							outputRelativePath.startsWith(sep)
						) {
							throw new Error(
								`Archive entry escapes the install directory: ${entry.fileName}`,
							);
						}

						if (entry.fileName.endsWith("/")) {
							await mkdir(outputPath, { recursive: true });
						} else {
							const fileType = (entry.externalFileAttributes >>> 16) & 0o170000;
							if (fileType === 0o120000) {
								throw new Error(
									`Archive contains an unsupported symbolic link: ${entry.fileName}`,
								);
							}
							await mkdir(resolve(outputPath, ".."), { recursive: true });
							const readStream = await new Promise(
								(resolveStream, rejectStream) => {
									zipfile.openReadStream(entry, (streamError, stream) => {
										if (streamError) rejectStream(streamError);
										else resolveStream(stream);
									});
								},
							);
							await pipeline(
								readStream,
								createWriteStream(outputPath, { flags: "wx" }),
							);
						}

						zipfile.readEntry();
					})().catch(fail);
				});
				zipfile.readEntry();
			},
		);
	});
}

async function promptForUrl() {
	const readline = createInterface({ input: stdin, output: stdout });
	try {
		return (
			await readline.question("Foundry Node instance download URL: ")
		).trim();
	} finally {
		readline.close();
	}
}

async function downloadArchive(url, archivePath) {
	let response;
	try {
		response = await fetch(url);
	} catch {
		throw new Error("Unable to download the Foundry Node instance.");
	}
	if (!response.ok) {
		throw new Error(
			`Foundry download failed with HTTP status ${response.status}.`,
		);
	}
	if (!response.body) {
		throw new Error("The Foundry download did not contain a response body.");
	}

	await pipeline(
		Readable.fromWeb(response.body),
		createWriteStream(archivePath, { flags: "wx" }),
	);
}

async function installFoundry() {
	const moduleMetadata = JSON.parse(await readFile(modulePath, "utf8"));
	const verifiedVersion = moduleMetadata.compatibility?.verified;
	if (typeof verifiedVersion !== "string" || !verifiedVersion) {
		throw new Error("module.json is missing compatibility.verified.");
	}

	const installedVersion = await readInstanceVersion(
		join(instancePath, "package.json"),
	);
	if (installedVersion === verifiedVersion) {
		console.log(
			`Foundry ${verifiedVersion} is already installed; skipping download.`,
		);
		return;
	}

	const downloadUrl = await promptForUrl();
	if (!downloadUrl) {
		throw new Error("A download URL is required.");
	}
	let parsedUrl;
	try {
		parsedUrl = new URL(downloadUrl);
	} catch {
		throw new Error("Enter a valid HTTP or HTTPS download URL.");
	}
	if (!["http:", "https:"].includes(parsedUrl.protocol)) {
		throw new Error("Enter a valid HTTP or HTTPS download URL.");
	}

	await mkdir(localDirectory, { recursive: true });
	const temporaryDirectory = await mkdtemp(join(tmpdir(), "foundry-install-"));
	const stagingDirectory = await mkdtemp(
		join(localDirectory, ".instance-staging-"),
	);
	const archivePath = join(temporaryDirectory, "foundry.zip");
	let backupPath;

	try {
		console.log("Downloading Foundry Node instance...");
		await downloadArchive(parsedUrl, archivePath);
		console.log("Extracting Foundry Node instance...");
		await extractZip(archivePath, stagingDirectory);

		const downloadedVersion = await readInstanceVersion(
			join(stagingDirectory, "package.json"),
		);
		if (downloadedVersion !== verifiedVersion) {
			throw new Error(
				`Downloaded Foundry version ${downloadedVersion ?? "unknown"} does not match ${verifiedVersion}.`,
			);
		}

		try {
			await access(instancePath);
			backupPath = join(
				localDirectory,
				`.instance-backup-${process.pid}-${Date.now()}`,
			);
			await rename(instancePath, backupPath);
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}

		try {
			await rename(stagingDirectory, instancePath);
		} catch (error) {
			if (backupPath) await rename(backupPath, instancePath);
			throw error;
		}

		if (backupPath) await rm(backupPath, { recursive: true, force: true });
		console.log(`Foundry ${verifiedVersion} installed in test/local/instance.`);
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
		await rm(stagingDirectory, { recursive: true, force: true });
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	try {
		await installFoundry();
	} catch (error) {
		console.error(`Foundry installation failed: ${error.message}`);
		process.exitCode = 1;
	}
}

export { extractZip, getFoundryVersion };
