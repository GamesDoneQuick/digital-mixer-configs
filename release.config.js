module.exports = {
	release: {
		branch: 'master',
	},
	plugins: [
		'@semantic-release/commit-analyzer',
		'@semantic-release/release-notes-generator',
		'./.build/build/update-version-numbers.js',
		["@semantic-release/exec", {
			"prepareCmd": "zip -r x32-configs.zip Road Studio README.md",
		}],
		["@semantic-release/github", {
			"assets": [
				{"path": "x32-configs.zip", "label": "x32-configs.zip"}
			]
		}]
	],

	debug: true
};
