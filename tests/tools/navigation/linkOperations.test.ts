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
		isWithinTeamDocs: jest.fn(),
	},
}));

let PathUtils: any;
let cleanAndResolvePath: any;

describe("linkOperations tools", () => {
	let app: App;
	let plugin: any;
	let createLinkOperationTools: any;
	let TFileRef: any;
	let makeTFile: (basename: string) => any;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		({
			createLinkOperationTools,
		} = require("../../../src/tools/navigation/linkOperations"));

		TFileRef = require("obsidian").TFile;
		makeTFile = (basename: string) => {
			const obj: any = Object.create((TFileRef as any).prototype);
			obj.basename = basename;
			return obj;
		};

		PathUtils = require("../../../src/utils/PathUtils").PathUtils;
		cleanAndResolvePath =
			require("../../../src/tools/core/utils").cleanAndResolvePath;

		app = createMockApp();
		plugin = createMockPlugin(app);
		(plugin.app as any).vault.read = jest.fn();
		(plugin.app as any).metadataCache = { resolvedLinks: {} };

		(PathUtils.isWithinAiScope as jest.Mock).mockReturnValue(true);
		(PathUtils.isWithinTeamDocs as jest.Mock).mockImplementation(
			(_p: string, _root: string) => true
		);
	});

	describe("follow_links", () => {
		test("extracts wikilinks, reads snippets, respects maxLinksPerLevel", async () => {
			const tools = createLinkOperationTools(plugin);
			const currentPath = "Team/Docs/root.md";
			const md = "See [[A]] and [[B|alt]] and a duplicate [[A]].";

			(PathUtils.isWithinTeamDocs as jest.Mock).mockReturnValue(true);

			(plugin.app as any).vault.getAbstractFileByPath = jest.fn((p: string) => {
				if (p.endsWith("A.md")) return makeTFile("A");
				if (p.endsWith("B.md")) return makeTFile("B");
				return null;
			});
			(plugin.app as any).vault.read.mockImplementation(
				async (file: any) => `content-${file.basename}`
			);

			const res = await tools.follow_links.execute({
				content: md,
				currentPath,
				maxDepth: 1,
				maxLinksPerLevel: 1,
				snippetLength: 10,
			});

			expect(res.currentPath).toBe(currentPath);
			expect(res.followedDocs.length).toBe(1);
			expect(res.followedDocs[0].path.endsWith("A.md")).toBe(true);
			expect(res.followedDocs[0].title).toBe("A");
			expect(res.followedDocs[0].snippet).toBe("content-A".slice(0, 10));
			expect(res.followedDocs[0].depth).toBe(1);
			expect(res.hasMore).toBe(false);
		});
	});

	describe("get_backlinks", () => {
		test("returns error when outside AI scope after cleaning", async () => {
			const tools = createLinkOperationTools(plugin);
			(PathUtils.isWithinAiScope as jest.Mock).mockReturnValueOnce(false);
			const out = await tools.get_backlinks.execute({ path: "doc.md" });
			expect(out).toEqual({
				error: {
					code: "outside-sync-folder",
					message: "Path 'doc.md' is outside the team docs folder.",
				},
			});
			expect(cleanAndResolvePath).toHaveBeenCalledWith(
				"doc.md",
				plugin.settings.teamDocsPath
			);
		});

		test("lists backlinks up to k with snippets", async () => {
			const tools = createLinkOperationTools(plugin);
			(PathUtils.isWithinAiScope as jest.Mock).mockReturnValue(true);
			(plugin.app as any).metadataCache.resolvedLinks = {
				"Team/Docs/A.md": { "doc.md": 2 },
				"Team/Docs/B.md": { "doc.md": 1 },
				"Team/Docs/C.md": { "other.md": 1 },
			};

			(plugin.app as any).vault.getAbstractFileByPath = jest.fn((p: string) =>
				makeTFile((p.split("/").pop() ?? "").replace(".md", ""))
			);
			(plugin.app as any).vault.read = jest.fn(
				async (file: any) => `SNIPPET-${file.basename}`
			);

			const out = await tools.get_backlinks.execute({
				path: "doc.md",
				k: 2,
				snippetLength: 8,
			});

			expect(out.backlinks.length).toBe(2);
			expect(out.backlinks[0]).toMatchObject({
				path: "Team/Docs/A.md",
				title: "A",
				snippet: "SNIPPET-".slice(0, 8),
			});
			expect(out.backlinks[1]).toMatchObject({
				path: "Team/Docs/B.md",
				title: "B",
				snippet: "SNIPPET-".slice(0, 8),
			});
		});

		test("returns no-backlinks error when none found", async () => {
			const tools = createLinkOperationTools(plugin);
			(plugin.app as any).metadataCache.resolvedLinks = {
				"Team/Docs/A.md": { "other.md": 1 },
			};
			const out = await tools.get_backlinks.execute({ path: "doc.md" });
			expect(out).toEqual({
				error: {
					code: "no-backlinks",
					message: "No backlinks found for 'doc.md'.",
				},
			});
		});
	});

	describe("get_graph_context", () => {
		test("returns error when outside AI scope after cleaning", async () => {
			const tools = createLinkOperationTools(plugin);
			(PathUtils.isWithinAiScope as jest.Mock).mockReturnValueOnce(false);
			const out = await tools.get_graph_context.execute({ path: "doc.md" });
			expect(out).toEqual({
				error: {
					code: "outside-sync-folder",
					message: "Path 'doc.md' is outside the team docs folder.",
				},
			});
			expect(cleanAndResolvePath).toHaveBeenCalledWith(
				"doc.md",
				plugin.settings.teamDocsPath
			);
		});

		test("builds nodes and edges up to limits", async () => {
			const tools = createLinkOperationTools(plugin);
			(PathUtils.isWithinAiScope as jest.Mock).mockReturnValue(true);
			(plugin.app as any).metadataCache.resolvedLinks = {
				"doc.md": { "Team/Docs/A.md": 1, "Team/Docs/OUT.md": 1 },
				"Team/Docs/A.md": { "Team/Docs/B.md": 1 },
			};
			(plugin.app as any).vault.getAbstractFileByPath = jest.fn((p: string) =>
				makeTFile((p.split("/").pop() ?? "").replace(".md", "") ?? "")
			);

			const out = await tools.get_graph_context.execute({
				path: "doc.md",
				maxDepth: 2,
				maxNodes: 3,
			});

			expect(out.startingPath).toBe("doc.md");
			const nodeIds = out.nodes.map((n: any) => n.id);
			expect(nodeIds).toEqual(
				expect.arrayContaining(["doc.md", "Team/Docs/A.md"])
			);
			const edgePairs = out.edges.map((e: any) => `${e.from}->${e.to}`);
			expect(edgePairs).toContain("doc.md->Team/Docs/A.md");
			expect(typeof out.hasMore).toBe("boolean");
		});
	});
});
