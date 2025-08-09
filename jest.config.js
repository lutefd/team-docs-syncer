module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	testMatch: ["<rootDir>/tests/**/*.test.ts"],
	moduleFileExtensions: ["ts", "tsx", "js"],
	moduleNameMapper: {
		"^obsidian$": "<rootDir>/tests/mocks/obsidian.ts",
		"^electron$": "<rootDir>/tests/mocks/stub.ts",
	},
	globals: {
		"ts-jest": {
			tsconfig: "<rootDir>/tsconfig.jest.json",
			diagnostics: false,
		},
	},
};
