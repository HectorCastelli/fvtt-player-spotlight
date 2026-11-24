import fs from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { simpleGit } from "simple-git";
import { ZipFile } from "yazl";

const repoRoot = join(import.meta.dirname, "..");

export async function bundle(version = "latest") {
	console.log("Bundling the module...");

	const distPath = join(repoRoot, "dist");
	fs.rmSync(distPath, { recursive: true, force: true });
	fs.mkdirSync(distPath, { recursive: true });
	console.log("Created dist folder.");

	// Add all necessary files directly to the archive
	const needed = [
		"lang",
		"src",
		"styles",
		"module.json",
		"README.md",
		"UNLICENSE",
	];

	const moduleContents = fs
		.readFileSync(join(repoRoot, "module.json"), "utf8")
		.replaceAll("@VERSION", version);
	const git = simpleGit(repoRoot);
	const tags = await git.tags();
	const previousTag = tags.all.length
		? (await git.raw(["describe", "--tags", "--abbrev=0"])).trim()
		: undefined;
	const { all: changes } = await git.log({
		...(previousTag ? { from: previousTag, to: "HEAD" } : {}),
		format: {
			hash: "%h",
			subject: "%s",
			committer: "%cN",
		},
	});
	const changelog = `# ${version}\n\n## Changes\n\n${changes
		.map(({ hash, subject, committer }) => {
			return `- ${subject} (${hash}) by ${committer}`;
		})
		.join("\n")}\n`;

	fs.writeFileSync(join(distPath, "module.json"), moduleContents);
	fs.writeFileSync(join(distPath, "CHANGELOG.md"), changelog);

	const archive = new ZipFile();
	archive.on("error", (error) => archive.outputStream.destroy(error));

	function zipDirectory(directoryPath, archivePath) {
		archive.addEmptyDirectory(archivePath);

		for (const entry of fs.readdirSync(directoryPath, {
			withFileTypes: true,
		})) {
			const sourcePath = join(directoryPath, entry.name);
			const entryPath = `${archivePath}/${entry.name}`;
			if (entry.isDirectory()) {
				zipDirectory(sourcePath, entryPath);
			} else if (entry.isFile() || entry.isSymbolicLink()) {
				archive.addFile(sourcePath, entryPath, { compressionLevel: 9 });
			} else {
				throw new Error(
					`Unsupported file type in module bundle: ${sourcePath}`,
				);
			}
		}
	}

	for (const item of needed) {
		const sourcePath = join(repoRoot, item);
		if (item === "module.json") {
			archive.addBuffer(Buffer.from(moduleContents), item, {
				compressionLevel: 9,
			});
		} else if (fs.statSync(sourcePath).isDirectory()) {
			zipDirectory(sourcePath, item);
		} else {
			archive.addFile(sourcePath, item, { compressionLevel: 9 });
		}
	}

	const archiveComplete = pipeline(
		archive.outputStream,
		fs.createWriteStream(join(distPath, "module.zip")),
	);
	archive.end();
	await archiveComplete;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	if (!process.argv[2]) {
		console.log("No version number provided. Using default: latest");
	}
	await bundle(process.argv[2] || "latest");
}
