module.exports = {
	testMatch: [
		"**.spec.ts",
	],
	transform: {
		'^.+\\.ts$': ['ts-jest', {
			tsconfig: '<rootDir>/tsconfig.json',
			disableSourceMapSupport: true,
		}],
		'^.+\\.js$': ['babel-jest'],
	},
	transformIgnorePatterns: [
		'node_modules/(?!@zip.js)/'
	],
}
