// Native
import { execSync } from 'child_process';
import * as fs from 'fs';

// Packages
import * as appRootPath from 'app-root-path';
import * as readdir from 'recursive-readdir';

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
	lastRelease: BaseRelease;
	nextRelease: {
		type: SemverRelease;
		notes: string;
	} & BaseRelease;
	commits: Commit[];
	releases: Release[];
	logger: {
		error: (str: string) => void;
		success: (str: string) => void;
		log: (str: string) => void;
	};
}

const nameRegex = /(^#\d\.\d# ")(?<name>.*?)(_dev")/;

/**
 * Called by semantic-release during the verification step
 * @param pluginConfig The semantic-release plugin config
 * @param context The context provided by semantic-release
 */
async function prepare(_: unknown, context: Context) {
	const { nextRelease, releases, logger } = context;
	const unhandledFiles = new Set<string>(await enumScenesAndSnippets());
	const handledFiles = new Map<string, string>();
	const allReleases = [...releases, nextRelease].reverse();
	for (const [index, release] of [...releases, nextRelease].reverse().entries()) {
		const prevRelease: BaseRelease | undefined = allReleases[index + 1];
		const changedFiles = prevRelease ?
			execSync(`git diff --name-only ${prevRelease.gitHead}..${release.gitHead}`).toString().split('\n') :
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
		logger.log(`Unhandled files:\n\t${Array.from(unhandledFiles).join('\n')}`);
	}

	logger.log(`Handled files:\n\t${
		Array.from(handledFiles.entries()).map(([file, version]) => {
			return `${file} - ${version}`;
		}).join('\n')
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
	const files = await readdir(appRootPath.path, ignorePatterns);
	return files.filter(isSceneOrSnippet);
}

function isSceneOrSnippet(filePath: string): boolean {
	return filePath.endsWith('.snp') || filePath.endsWith('.scn');
}

module.exports = { prepare };
