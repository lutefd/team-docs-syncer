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

describe("fileOperations tools", () => {
	let app: App;
	let plugin: any;
	let createFileOperationTools: any;
	let TFileRef: any;
	let TFolderRef: any;

	const makeTFile = (path: string, size = 0, mtime = 0) => {
		const obj: any = Object.create((TFileRef as any).prototype);
		obj.path = path;
		obj.basename =
			path
				.split("/")
				.pop()
				?.replace(/\.md$|\.txt$/i, "") ?? path;
		obj.stat = { size, mtime };
		return obj;
	};
	const makeTFolder = (path: string, children: any[] = []) => {
		const obj: any = Object.create((TFolderRef as any).prototype);
		obj.path = path;
		obj.children = children;
		return obj;
	};

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({
			createFileOperationTools,
		} = require("../../../src/tools/obsidian/fileOperations"));

		TFileRef = require("obsidian").TFile;
		TFolderRef = require("obsidian").TFolder;
		cleanAndResolvePath =
			require("../../../src/tools/core/utils").cleanAndResolvePath;
		PathUtils = require("../../../src/utils/PathUtils").PathUtils;

		app = createMockApp();
		plugin = createMockPlugin(app);

		(PathUtils.isWithinAiScope as jest.Mock).mockReturnValue(true);

		(plugin.app as any).vault.getAbstractFileByPath = jest.fn();
		(plugin.app as any).vault.read = jest.fn();
		(plugin.app as any).vault.createFolder = jest.fn();
		(plugin.app as any).vault.create = jest.fn();
	});

	describe("read_doc", () => {
		test("outside scope returns error", async () => {
			const tools = createFileOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("/X/out.md");
			(PathUtils.isWithinAiScope as jest.Mock).mockReturnValueOnce(false);

			const out = await tools.read_doc.execute({ path: "[[out]]" });
			expect(cleanAndResolvePath).toHaveBeenCalledWith(
				"[[out]]",
				plugin.settings.teamDocsPath
			);
			expect(out).toEqual({
				error: {
					code: "outside-sync-folder",
					message: "Path '/X/out.md' is outside the team docs folder.",
				},
			});
		});

		test("not found when target is not a TFile", async () => {
			const tools = createFileOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("Team/Docs/missing.md");
			(plugin.app as any).vault.getAbstractFileByPath.mockReturnValueOnce(null);

			const out = await tools.read_doc.execute({
				path: "Team/Docs/missing.md",
			});
			expect(out).toEqual({
				error: {
					code: "not-found",
					message: "File not found: Team/Docs/missing.md",
				},
			});
		});

		test("reads content successfully", async () => {
			const tools = createFileOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("Team/Docs/a.md");
			const file = makeTFile("Team/Docs/a.md");
			(plugin.app as any).vault.getAbstractFileByPath.mockReturnValueOnce(file);
			(plugin.app as any).vault.read.mockResolvedValueOnce("CONTENT");

			const out = await tools.read_doc.execute({ path: "Team/Docs/a.md" });
			expect(out).toEqual({ path: "Team/Docs/a.md", content: "CONTENT" });
		});

		test("read failure returns read-failed", async () => {
			const tools = createFileOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("Team/Docs/a.md");
			const file = makeTFile("Team/Docs/a.md");
			(plugin.app as any).vault.getAbstractFileByPath.mockReturnValueOnce(file);
			(plugin.app as any).vault.read.mockRejectedValueOnce(new Error("boom"));

			const out = await tools.read_doc.execute({ path: "Team/Docs/a.md" });
			expect(out).toEqual({
				error: { code: "read-failed", message: "Failed to read file: boom" },
			});
		});
	});

	describe("propose_edit", () => {
		test("outside scope returns error", async () => {
			const tools = createFileOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("/X/a.md");
			(PathUtils.isWithinAiScope as jest.Mock).mockReturnValueOnce(false);

			const out = await tools.propose_edit.execute({
				path: "Team/Docs/a.md",
				content: "x",
			});
			expect(out.error.code).toBe("outside-sync-folder");
		});

		test("empty content returns no-content-provided", async () => {
			const tools = createFileOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("Team/Docs/a.md");

			const out = await tools.propose_edit.execute({
				path: "Team/Docs/a.md",
				content: "   ",
			});
			expect(out).toEqual({
				error: {
					code: "no-content-provided",
					message: "Content must be provided for edits.",
				},
			});
		});

		test("success returns ok path content and instructions default", async () => {
			const tools = createFileOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("Team/Docs/a.md");

			const out = await tools.propose_edit.execute({
				path: "Team/Docs/a.md",
				content: "NEW",
			});
			expect(out).toEqual({
				ok: true,
				path: "Team/Docs/a.md",
				content: "NEW",
				instructions: "",
			});
		});
	});

	describe("create_doc", () => {
		test("outside scope error", async () => {
			const tools = createFileOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("/X/new.md");
			(PathUtils.isWithinAiScope as jest.Mock).mockReturnValueOnce(false);
			const out = await tools.create_doc.execute({
				path: "Team/Docs/new.md",
				content: "C",
			});
			expect(out.error.code).toBe("outside-sync-folder");
		});

		test("already exists error", async () => {
			const tools = createFileOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("Team/Docs/exist.md");
			(plugin.app as any).vault.getAbstractFileByPath.mockReturnValueOnce({});
			const out = await tools.create_doc.execute({
				path: "Team/Docs/exist.md",
				content: "C",
			});
			expect(out).toEqual({
				error: {
					code: "already-exists",
					message: "File already exists: Team/Docs/exist.md",
				},
			});
		});

		test("creates folder (ignored error) and file successfully", async () => {
			const tools = createFileOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("Team/Docs/new.md");
			(plugin.app as any).vault.getAbstractFileByPath.mockReturnValueOnce(
				undefined
			);
			(plugin.app as any).vault.createFolder.mockRejectedValueOnce(
				new Error("exists")
			);
			(plugin.app as any).vault.create.mockResolvedValueOnce({
				path: "Team/Docs/new.md",
			});

			const out = await tools.create_doc.execute({
				path: "Team/Docs/new.md",
				content: "C",
			});
			expect(out).toEqual({
				ok: true,
				path: "Team/Docs/new.md",
				content: "C",
				instructions: "",
			});
		});

		test("create failure returns create-failed", async () => {
			const tools = createFileOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("Team/Docs/new.md");
			(plugin.app as any).vault.getAbstractFileByPath.mockReturnValueOnce(
				undefined
			);
			(plugin.app as any).vault.create.mockRejectedValueOnce(new Error("boom"));

			const out = await tools.create_doc.execute({
				path: "Team/Docs/new.md",
				content: "C",
			});
			expect(out).toEqual({
				error: {
					code: "create-failed",
					message: "Failed to create file: boom",
				},
			});
		});
	});

	describe("list_docs", () => {
		test("outside scope with provided path", async () => {
			const tools = createFileOperationTools(plugin);
			(PathUtils.isWithinAiScope as jest.Mock).mockReturnValueOnce(false);
			const out = await tools.list_docs.execute({
				path: "Other/",
				recursive: false,
			});
			expect(out).toEqual({
				error: {
					code: "outside-sync-folder",
					message: "Path 'Other/' is outside the team docs folder.",
				},
			});
		});

		test("outside scope when defaulting to team root", async () => {
			const tools = createFileOperationTools(plugin);
			(PathUtils.isWithinAiScope as jest.Mock).mockImplementation((p: string) =>
				p !== plugin.settings.teamDocsPath ? true : false
			);
			const out = await tools.list_docs.execute({});
			expect(out.error.code).toBe("outside-sync-folder");
		});

		test("not-folder error when path resolves to a file", async () => {
			const tools = createFileOperationTools(plugin);
			const file = makeTFile("Team/Docs/a.md");
			(plugin.app as any).vault.getAbstractFileByPath.mockReturnValueOnce(file);
			const out = await tools.list_docs.execute({ path: "Team/Docs/a.md" });
			expect(out).toEqual({
				error: {
					code: "not-folder",
					message: "Path 'Team/Docs/a.md' is not a folder.",
				},
			});
		});

		test("lists files and folders with recursion and filtering", async () => {
			const tools = createFileOperationTools(plugin);
			const root = makeTFolder("Team/Docs");
			const f1 = makeTFile("Team/Docs/a.md", 10, 1000);
			const folder1 = makeTFolder("Team/Docs/folder1");
			const f2 = makeTFile("Team/Docs/folder1/b.txt", 5, 2000);
			const sub = makeTFolder("Team/Docs/folder1/sub");
			const f3 = makeTFile("Team/Docs/folder1/sub/c.md", 7, 3000);
			(root as any).children = [f1, folder1];
			(folder1 as any).children = [f2, sub];
			(sub as any).children = [f3];

			(plugin.app as any).vault.getAbstractFileByPath.mockReturnValueOnce(root);

			const out = await tools.list_docs.execute({
				path: "Team/Docs",
				recursive: true,
				maxDepth: 3,
				filterExtension: ".md",
			});

			const items = out.items as Array<any>;
			const filePaths = items
				.filter((i) => i.type === "file")
				.map((i) => i.path);
			const folderPaths = items
				.filter((i) => i.type === "folder")
				.map((i) => i.path);
			expect(filePaths).toEqual([
				"Team/Docs/a.md",
				"Team/Docs/folder1/sub/c.md",
			]);
			expect(folderPaths).toEqual([
				"Team/Docs/folder1",
				"Team/Docs/folder1/sub",
			]);
			const firstFile = items.find((i) => i.type === "file");
			expect(typeof firstFile.size).toBe("number");
			expect(typeof firstFile.modified).toBe("string");
		});
	});
});
