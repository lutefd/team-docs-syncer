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
	PathUtils: { isWithinAiScope: jest.fn() },
}));

let cleanAndResolvePath: jest.Mock;
let PathUtils: any;

describe("searchOperations tools", () => {
	let app: App;
	let plugin: any;
	let createSearchOperationTools: any;
	let TFileRef: any;

	const makeTFile = (path: string, content: string = "") => {
		const obj: any = Object.create((TFileRef as any).prototype);
		obj.path = path;
		obj.basename = path.split("/").pop()?.replace(/\.md$/i, "") ?? path;
		obj.extension = path.split(".").pop();
		obj.__content = content;
		return obj;
	};

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		({
			createSearchOperationTools,
		} = require("../../../src/tools/obsidian/searchOperations"));

		TFileRef = require("obsidian").TFile;
		cleanAndResolvePath =
			require("../../../src/tools/core/utils").cleanAndResolvePath;
		PathUtils = require("../../../src/utils/PathUtils").PathUtils;

		app = createMockApp();
		plugin = createMockPlugin(app);

		(PathUtils.isWithinAiScope as jest.Mock).mockReturnValue(true);

		(plugin.app as any).vault.getAbstractFileByPath = jest.fn();
		(plugin.app as any).vault.getMarkdownFiles = jest.fn(() => []);
		(plugin.app as any).vault.read = jest.fn(
			async (f: any) => f.__content ?? ""
		);
		(plugin.app as any).metadataCache = {
			getFileCache: jest.fn(() => ({ tags: [], frontmatter: {} })),
		} as any;

		plugin.markdownIndexService = { search: jest.fn(() => []) };
	});

	describe("search_docs", () => {
		test("returns empty array when no hits", async () => {
			const tools = createSearchOperationTools(plugin);
			(plugin.markdownIndexService.search as jest.Mock).mockReturnValueOnce([]);
			const res = await tools.search_docs.execute({ query: "foo" });
			expect(withRetryMock).toHaveBeenCalled();
			expect(res).toEqual([]);
		});

		test("returns results with snippets when file resolvable", async () => {
			const tools = createSearchOperationTools(plugin);
			(plugin.markdownIndexService.search as jest.Mock).mockReturnValueOnce([
				{ path: "Team/Docs/A.md", title: "A", frontmatter: { x: 1 } },
				{ path: "Team/Docs/Missing.md", title: "Missing", frontmatter: {} },
			]);
			const a = makeTFile("Team/Docs/A.md", "Hello world content");
			(plugin.app as any).vault.getAbstractFileByPath = jest.fn((p: string) =>
				p === a.path ? a : null
			);

			const res = await tools.search_docs.execute({
				query: "hello",
				k: 5,
				snippetLength: 5,
			});
			expect(res[0]).toMatchObject({
				path: "Team/Docs/A.md",
				title: "A",
				frontmatter: { x: 1 },
				snippet: "Hello",
			});
			expect(res[1]).toMatchObject({
				path: "Team/Docs/Missing.md",
				title: "Missing",
			});
		});
	});

	describe("search_tags", () => {
		test("returns no-results error when none match", async () => {
			const tools = createSearchOperationTools(plugin);
			const f1 = makeTFile("Team/Docs/A.md", "A content");
			(plugin.app as any).vault.getMarkdownFiles = jest.fn(() => [f1]);
			(plugin.app as any).metadataCache.getFileCache = jest.fn(() => ({
				tags: [],
				frontmatter: {},
			}));
			const out = await tools.search_tags.execute({ tag: "#project" });
			expect(out).toEqual({
				error: {
					code: "no-results",
					message: "No documents found with tag '#project'.",
				},
			});
		});

		test("finds by tag or frontmatter and limits by k with snippets", async () => {
			const tools = createSearchOperationTools(plugin);
			const f1 = makeTFile("Team/Docs/A.md", "One".repeat(100));
			const f2 = makeTFile("Team/Docs/B.md", "Two".repeat(100));
			const f3 = makeTFile("Team/Docs/C.md", "Three".repeat(100));
			(plugin.app as any).vault.getMarkdownFiles = jest.fn(() => [f1, f2, f3]);
			(plugin.app as any).metadataCache.getFileCache = jest.fn((file: any) => {
				if (file.path.endsWith("A.md"))
					return { tags: [{ tag: "#tag" }], frontmatter: {} };
				if (file.path.endsWith("B.md"))
					return { tags: [], frontmatter: { status: "active" } };
				return { tags: [], frontmatter: {} };
			});
			const out = await tools.search_tags.execute({
				tag: "#tag",
				k: 2,
				snippetLength: 10,
			});
			expect(Array.isArray(out)).toBe(true);
			expect((out as any[]).length).toBe(1);
			expect(out[0]).toMatchObject({ path: "Team/Docs/A.md", title: "A" });
			expect(out[0].snippet?.length).toBe(10);

			const out2 = await tools.search_tags.execute({
				tag: "status: active",
				k: 1,
				snippetLength: 5,
			});
			expect(out2.length).toBe(1);
			expect(out2[0]).toMatchObject({ path: "Team/Docs/B.md", title: "B" });
			expect(out2[0].snippet?.length).toBe(5);
		});
	});

	describe("search_similar", () => {
		test("returns no-results when no candidates get positive score", async () => {
			const tools = createSearchOperationTools(plugin);
			(plugin.app as any).vault.getMarkdownFiles = jest.fn(() => []);
			const out = await tools.search_similar.execute({
				query: "",
				tags: [],
				k: 5,
			});
			expect(out).toEqual({
				error: {
					code: "no-results",
					message: "No similar documents found for the given query/tags.",
				},
			});
		});

		test("ranks by tags + index hits + content matches and returns base yaml", async () => {
			const tools = createSearchOperationTools(plugin);
			const f1 = makeTFile("Team/Docs/Alpha.md", "alpha alpha foo");
			const f2 = makeTFile("Team/Docs/Beta.md", "beta foo bar\n#alpha");
			(plugin.app as any).vault.getMarkdownFiles = jest.fn(() => [f1, f2]);
			(plugin.app as any).metadataCache.getFileCache = jest.fn((file: any) => {
				if (file.path.endsWith("Alpha.md"))
					return { tags: [{ tag: "#alpha" }], frontmatter: {} };
				if (file.path.endsWith("Beta.md"))
					return { tags: [{ tag: "#alpha" }], frontmatter: {} };
				return { tags: [], frontmatter: {} };
			});
			(plugin.markdownIndexService.search as jest.Mock).mockReturnValueOnce([
				{ path: "Team/Docs/Alpha.md" },
			]);

			const out: any = await tools.search_similar.execute({
				query: "foo",
				tags: ["#alpha"],
				k: 2,
				snippetLength: 10,
			});
			expect(out.results.length).toBeGreaterThan(0);
			expect(out.base.yaml).toContain("file.hasTag('alpha')");
			expect(out.results[0]).toHaveProperty("score");
			expect(out.results[0]).toHaveProperty("matchedTerms");
			expect(out.results[0]).toHaveProperty("snippet");
		});
	});

	describe("find_similar_to_doc", () => {
		test("outside ai scope error", async () => {
			const tools = createSearchOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("/X/A.md");
			(PathUtils.isWithinAiScope as jest.Mock).mockReturnValueOnce(false);
			const out = await tools.find_similar_to_doc.execute({ path: "[[A]]" });
			expect(out).toEqual({
				error: {
					code: "outside-ai-scope",
					message: "Path '/X/A.md' is outside the AI scope",
				},
			});
		});

		test("not found when path not a TFile", async () => {
			const tools = createSearchOperationTools(plugin);
			cleanAndResolvePath.mockReturnValueOnce("Team/Docs/A.md");
			(plugin.app as any).vault.getAbstractFileByPath = jest.fn(() => null);
			const out = await tools.find_similar_to_doc.execute({
				path: "Team/Docs/A.md",
			});
			expect(out).toEqual({
				error: { code: "not-found", message: "File not found: Team/Docs/A.md" },
			});
		});

		test("not-markdown when file extension not md", async () => {
			const tools = createSearchOperationTools(plugin);
			const a = makeTFile("Team/Docs/A.txt", "content");
			(plugin.app as any).vault.getAbstractFileByPath = jest.fn(() => a);
			const out = await tools.find_similar_to_doc.execute({
				path: "Team/Docs/A.txt",
			});
			expect(out).toEqual({
				error: {
					code: "not-markdown",
					message: "Only markdown files are supported; got .txt",
				},
			});
		});

		test("returns ranked results and base yaml relative to seed", async () => {
			const tools = createSearchOperationTools(plugin);
			const a = makeTFile("Team/Docs/A.md", "alpha foo alpha");
			const b = makeTFile("Team/Docs/B.md", "foo bar alpha");
			(plugin.app as any).vault.getAbstractFileByPath = jest.fn((p: string) =>
				p === a.path ? a : p === b.path ? b : null
			);
			(plugin.app as any).vault.getMarkdownFiles = jest.fn(() => [a, b]);
			(plugin.app as any).metadataCache.getFileCache = jest.fn((file: any) => {
				if (file === a)
					return { tags: [{ tag: "#alpha" }], frontmatter: { title: "Seed" } };
				if (file === b) return { tags: [{ tag: "#alpha" }], frontmatter: {} };
				return { tags: [], frontmatter: {} };
			});
			(plugin.markdownIndexService.search as jest.Mock).mockReturnValueOnce([
				{ path: b.path },
			]);

			const out: any = await tools.find_similar_to_doc.execute({
				path: "Team/Docs/A.md",
				k: 3,
				snippetLength: 10,
			});
			expect(out.seed).toMatchObject({ path: a.path, title: "Seed" });
			expect(out.results.length).toBeGreaterThan(0);
			expect(out.base.yaml).toContain("Related to Seed");
		});

		test("returns no-results when nothing scores positively", async () => {
			const tools = createSearchOperationTools(plugin);
			const a = makeTFile("Team/Docs/A.md", "no matches here");
			(plugin.app as any).vault.getAbstractFileByPath = jest.fn(() => a);
			(plugin.app as any).vault.getMarkdownFiles = jest.fn(() => [a]);
			(plugin.app as any).metadataCache.getFileCache = jest.fn(() => ({
				tags: [],
				frontmatter: {},
			}));
			(plugin.markdownIndexService.search as jest.Mock).mockReturnValueOnce([]);

			const out = await tools.find_similar_to_doc.execute({
				path: "Team/Docs/A.md",
			});
			expect(out).toEqual({
				error: {
					code: "no-results",
					message: "No similar documents found for the selected file.",
				},
			});
		});
	});

	describe("find_similar_to_many", () => {
		test("no-seeds error when none valid within scope", async () => {
			const tools = createSearchOperationTools(plugin);
			(PathUtils.isWithinAiScope as jest.Mock).mockReturnValue(false);
			const out = await tools.find_similar_to_many.execute({
				paths: ["[[A]]"],
			});
			expect(out).toEqual({
				error: {
					code: "no-seeds",
					message: "No valid seed markdown files within AI scope.",
				},
			});
		});

		test("aggregates across seeds, excludes seeds, returns results and base", async () => {
			const tools = createSearchOperationTools(plugin);
			const a = makeTFile("Team/Docs/A.md", "alpha foo");
			const b = makeTFile("Team/Docs/B.md", "beta bar");
			const c = makeTFile("Team/Docs/C.md", "alpha alpha baz");

			(plugin.app as any).vault.getAbstractFileByPath = jest.fn(
				(p: string) =>
					(({ [a.path]: a, [b.path]: b, [c.path]: c } as any)[p] || null)
			);
			(plugin.app as any).metadataCache.getFileCache = jest.fn((file: any) => {
				if (file === a) return { tags: [{ tag: "#alpha" }], frontmatter: {} };
				if (file === b) return { tags: [{ tag: "#beta" }], frontmatter: {} };
				if (file === c) return { tags: [{ tag: "#alpha" }], frontmatter: {} };
				return { tags: [], frontmatter: {} };
			});
			(plugin.app as any).vault.getMarkdownFiles = jest.fn(() => [a, b, c]);
			(plugin.markdownIndexService.search as jest.Mock).mockReturnValueOnce([
				{ path: c.path },
			]);

			const out: any = await tools.find_similar_to_many.execute({
				paths: [a.path, b.path],
				k: 5,
				snippetLength: 10,
			});
			expect(out.seeds).toEqual([
				{ path: a.path, title: a.basename },
				{ path: b.path, title: b.basename },
			]);
			expect(out.results.some((r: any) => r.path === a.path)).toBe(false);
			expect(out.results.some((r: any) => r.path === b.path)).toBe(false);
			expect(out.results.some((r: any) => r.path === c.path)).toBe(true);
			expect(out.base.yaml).toContain("Related to 2 seeds");
		});
	});
});
