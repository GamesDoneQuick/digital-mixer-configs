// Native
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Packages
import * as appRootPath from 'app-root-path';
import * as readdir from 'recursive-readdir';

const rootDir = path.resolve(appRootPath.path, '..');
const enum SemverRelease {
	PATCH = 'patch',
	MINOR = 'minor',
	MAJOR = 'major',
}

type BaseRelease = {
	version: string;
	gitHead: string;
	gitTag: string;
	channel: string;
}

type Commit = {
	commit: {
		long: string;
		short: string;
	};
	tree: {
		long: string;
		short: string;
	};
	author: {
		name: string;
		email: string;
		short: string;
	};
	committer: {
		name: string;
		email: string;
		short: string;
	};
	subject: string;
	body: string;
	message: string;
	hash: string;
	committerDate: string;
}

type Release = {
	name: string;
	url: string;
	type: SemverRelease;
	notes: string;
	pluginName: string;
} & BaseRelease

type Context = {
	lastRelease?: BaseRelease;
	nextRelease: {
		type: SemverRelease;
		notes: string;
	} & BaseRelease;
	commits: Commit[];
	releases?: Release[];
	logger: {
		error: (str: string) => void;
		success: (str: string) => void;
		log: (str: string) => void;
	};
}

const nameRegex = /(^#\d\.\d# ")(?<name>.*?)(_dev")/;
const tagRegex = /(?<hash>\w+) refs\/tags\/v(?<version>(?:\d|\.)+)$/
const tagLineRegex = new RegExp(tagRegex, 'gm');

/**
 * Called by semantic-release during the verification step
 * @param pluginConfig The semantic-release plugin config
 * @param context The context provided by semantic-release
 */
async function prepare(_: unknown, context: Context) {
	const { nextRelease, logger } = context;
	if (!nextRelease) {
		return logger.error('No nextRelease!');
	}

	const unhandledFiles = new Set<string>(await enumScenesAndSnippets());
	const handledFiles = new Map<string, string>();
	const allReleases = [...enumTags(), nextRelease].reverse();
	for (const [index, release] of allReleases.entries()) {
		const prevRelease: BaseRelease | undefined = allReleases[index + 1];
		const changedFiles = prevRelease ?
			execSync(`git diff --name-only ${prevRelease.gitHead}..${release.gitHead}`)
				.toString()
				.split('\n')
				.map(fp => path.join(rootDir, fp)) :
			unhandledFiles.values();
		for (const changedFile of changedFiles) {
			if (!unhandledFiles.has(changedFile)) {
				continue;
			}

			unhandledFiles.delete(changedFile);
			handledFiles.set(changedFile, release.version);
		}
	}

	if (unhandledFiles.size > 0) {
		logger.log(`Unhandled files:\n  ${Array.from(unhandledFiles).join('\n  ')}`);
	}

	logger.log(`Handled files:\n  ${
		Array.from(handledFiles.entries()).map(([file, version]) => {
			return `${file} - ${version}`;
		}).join('\n  ')
	}`);

	for (const [filePath, version] of handledFiles) {
		const contents = fs.readFileSync(filePath, { encoding: 'utf-8' });
		const matches = contents.match(nameRegex);
		if (!matches?.groups?.name) {
			continue;
		}

		const versionedName = `${matches.groups.name}_v${version}`;
		fs.writeFileSync(filePath, contents.replace(nameRegex, `$1${versionedName}"`), {encoding: 'utf8'});
	}
	
}

async function enumScenesAndSnippets(): Promise<string[]> {
	const ignorePatterns = ['node_modules', '.build']
	const files = await readdir(rootDir, ignorePatterns);
	return files.filter(isSceneOrSnippet);
}

function isSceneOrSnippet(filePath: string): boolean {
	return filePath.endsWith('.snp') || filePath.endsWith('.scn');
}

function enumTags(): Array<BaseRelease> {
	const raw = execSync('git show-ref --tags').toString();
	const lines = raw.match(tagLineRegex);
	const results: Array<BaseRelease> = [];
	if (!lines) {
		return results;
	}

	for (const line of lines) {
		const matches = line.match(tagRegex);
		if (!matches?.groups?.hash || !matches?.groups?.version) {
			continue;
		}

		results.push({
			version: matches.groups.version,
			gitTag: `v${matches.groups.version}`,
			gitHead: matches.groups.hash,
			channel: 'master'
		});
	}
	return results;
}

module.exports = {prepare};
