import { createMockApp, createMockPlugin } from "../../helpers/mockPlugin";
import type { App } from "obsidian";

jest.mock("ai", () => ({ tool: (def: any) => def }));

const withRetryMock = jest.fn(async (fn: any) => await fn());
jest.mock("../../../src/tools/core/utils", () => {
	const actual = jest.requireActual("../../../src/tools/core/utils");
	return {
		...actual,
		withRetry: (fn: any) => withRetryMock(fn),
		cleanAndResolvePath: jest.fn((p: string, _root: string) => p),
	};
});

jest.mock("../../../src/utils/PathUtils", () => ({
	PathUtils: {
		isWithinAiScope: jest.fn(),
	},
}));

let cleanAndResolvePath: jest.Mock;
let PathUtils: any;

describe("basesOperations tools", () => {
	let app: App;
	let plugin: any;
	let createBasesOperationTools: any;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({
			createBasesOperationTools,
		} = require("../../../src/tools/obsidian/basesOperations"));

		cleanAndResolvePath =
			require("../../../src/tools/core/utils").cleanAndResolvePath;
		PathUtils = require("../../../src/utils/PathUtils").PathUtils;

		app = createMockApp();
		plugin = createMockPlugin(app);

		(PathUtils.isWithinAiScope as jest.Mock).mockReturnValue(true);

		(plugin.app as any).vault.getAbstractFileByPath = jest.fn();
		(plugin.app as any).vault.createFolder = jest.fn();
		(plugin.app as any).vault.create = jest.fn();
	});

	describe("create_base", () => {
		test("returns outside-ai-scope when path is not within AI scope after cleaning", async () => {
			const tools = createBasesOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("/X/base.base");
			(PathUtils.isWithinAiScope as jest.Mock).mockReturnValueOnce(false);

			const res = await tools.create_base.execute({
				path: "[[base]]",
				content: "yaml: true",
			});

			expect(cleanAndResolvePath).toHaveBeenCalledWith(
				"[[base]]",
				plugin.settings.teamDocsPath
			);
			expect(res).toEqual({
				error: {
					code: "outside-ai-scope",
					message: "Path '/X/base.base' is outside the AI scope.",
				},
			});
		});

		test("returns already-exists when a file already exists at cleanPath", async () => {
			const tools = createBasesOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("Team/Docs/existing.base");
			(plugin.app as any).vault.getAbstractFileByPath.mockReturnValueOnce({});

			const res = await tools.create_base.execute({
				path: "Team/Docs/existing.base",
				content: "yaml",
			});

			expect(res).toEqual({
				error: {
					code: "already-exists",
					message: "File already exists: Team/Docs/existing.base",
				},
			});
		});

		test("creates folder (ignores error) and creates file successfully, echoing content and instructions", async () => {
			const tools = createBasesOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("Team/Docs/new.base");
			(plugin.app as any).vault.getAbstractFileByPath.mockReturnValueOnce(
				undefined
			);
			(plugin.app as any).vault.createFolder.mockRejectedValueOnce(
				new Error("exists")
			);
			(plugin.app as any).vault.create.mockResolvedValueOnce({
				path: "Team/Docs/new.base",
			});

			const res = await tools.create_base.execute({
				path: "Team/Docs/new.base",
				content: "filters: {}\nviews: []",
				instructions: "Created new base",
			});

			expect(plugin.app.vault.create).toHaveBeenCalledWith(
				"Team/Docs/new.base",
				"filters: {}\nviews: []"
			);
			expect(res).toEqual({
				ok: true,
				path: "Team/Docs/new.base",
				content: "filters: {}\nviews: []",
				instructions: "Created new base",
			});
		});

		test("returns create-failed when vault.create throws", async () => {
			const tools = createBasesOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("Team/Docs/fail.base");
			(plugin.app as any).vault.getAbstractFileByPath.mockReturnValueOnce(
				undefined
			);
			(plugin.app as any).vault.create.mockRejectedValueOnce(new Error("boom"));

			const res = await tools.create_base.execute({
				path: "Team/Docs/fail.base",
				content: "x: 1",
			});

			expect(res).toEqual({
				error: {
					code: "create-failed",
					message: "Failed to create file: boom",
				},
			});
		});
	});

	describe("search_base_def", () => {
		test("returns documentation object and uses withRetry", async () => {
			const tools = createBasesOperationTools(plugin);
			const out = await tools.search_base_def.execute({});
			expect(withRetryMock).toHaveBeenCalled();
			expect(typeof out.overview).toBe("string");
			expect(typeof out.example).toBe("string");
			expect(out.schema && typeof out.schema).toBe("object");
			expect(Array.isArray(out.fileProperties)).toBe(true);
			expect(out.operators && typeof out.operators).toBe("object");
			expect(out.types && typeof out.types).toBe("object");
			expect(out.embedding && typeof out.embedding).toBe("object");
			expect(out.usage && typeof out.usage).toBe("object");
		});
	});
});
