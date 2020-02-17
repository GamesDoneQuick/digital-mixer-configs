module.exports = {
	release: {
		branch: 'master',
	},
	plugins: [
		'@semantic-release/commit-analyzer',
		'@semantic-release/release-notes-generator',
		'./.build/build/update-version-numbers.js',
		'@semantic-release/github'
	]
};
