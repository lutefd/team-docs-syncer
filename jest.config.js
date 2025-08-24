module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	testMatch: ["<rootDir>/tests/**/*.test.ts"],
	moduleFileExtensions: ["ts", "tsx", "js"],
	moduleNameMapper: {
		"^obsidian$": "<rootDir>/tests/mocks/obsidian.ts",
		"^electron$": "<rootDir>/tests/mocks/stub.ts",
		"^src/(.*)$": "<rootDir>/src/$1",
	},
	setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.ts"],
	globals: {
		"ts-jest": {
			tsconfig: "<rootDir>/tsconfig.jest.json",
			diagnostics: false,
		},
	},
};
