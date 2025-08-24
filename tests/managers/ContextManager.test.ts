import { ContextManager } from "../../src/managers/ContextManager";
import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import { App, TFile } from "obsidian";
import { PathUtils } from "../../src/utils/PathUtils";

describe("ContextManager", () => {
	let app: App;
	let plugin: any;

	beforeEach(() => {
		app = createMockApp();
		plugin = createMockPlugin(app);
		(app as any).vault.adapter = {
			exists: jest.fn(async () => false),
			read: jest.fn(async () => ""),
			write: jest.fn(async () => {}),
			mkdir: jest.fn(async () => {}),
			remove: jest.fn(async () => {}),
		} as any;

		plugin.markdownIndexService = {
			search: jest.fn((q: string, k: number) => [
				{ path: "Team/Docs/foo.md", title: "Foo" },
				{ path: "Outside/bar.md", title: "Bar" },
			]),
		};

		jest
			.spyOn(PathUtils, "isWithinAiScope")
			.mockImplementation((p: string) => p.startsWith("Team/Docs"));

		(app as any).vault.getAbstractFileByPath = jest.fn(
			(p: string) => new (TFile as any)(p)
		);
		(app as any).vault.read = jest.fn(
			async () => "# Title\ncontent content content"
		);

		plugin.chatSessionService = {
			getPinned: jest.fn(() => ["Team/Docs/pin.md"]),
			getActive: jest.fn(() => ({
				id: "s1",
				pinnedPaths: new Set(["Team/Docs/pin.md"]),
			})),
		};
		plugin.mcpManager.listAllTools = jest.fn(async () => [
			{
				clientId: "c1",
				clientName: "Client 1",
				tools: [{ name: "toolA" }, { name: "toolB" }],
			},
			{ clientId: "c2", clientName: "Client 2", tools: [{ name: "toolX" }] },
		]);
	});

	test("buildContext assembles docs, pins, and MCP overview without summary", async () => {
		const mgr = new ContextManager(plugin);
		const req = {
			sessionId: "s1",
			messages: [
				{ role: "user", content: "search term" },
				{ role: "assistant", content: "ok" },
			],
			mcpSelection: { clientIds: ["c1"] },
		} as any;
		const policy = {
			summarizeOverTokens: 999999,
			historyMaxMessages: 10,
			retrieval: { enableVault: true, k: 5, snippetLength: 20 },
			includeMCPOverview: true,
		} as any;

		const res = await mgr.buildContext(req, policy);

		expect(res.summaryText).toBeNull();
		expect(res.trimmedMessages.length).toBe(2);
		expect(res.metrics.retrievalCount).toBeGreaterThan(0);

		expect(res.systemAugment).toContain("Relevant Docs");
		expect(res.systemAugment).toContain("Pinned Files");
		expect(res.systemAugment).toContain("MCP Tools Available");
		expect(res.systemAugment).toContain("toolA");
	});

	test("buildContext performs summarization when threshold exceeded", async () => {
		const mgr = new ContextManager(plugin);
		const req = {
			sessionId: "s1",
			messages: [
				{ role: "user", content: "a" },
				{ role: "assistant", content: "b" },
			],
			mcpSelection: undefined,
		} as any;
		const policy = {
			summarizeOverTokens: 0,
			historyMaxMessages: 1,
			retrieval: { enableVault: false, k: 0, snippetLength: 0 },
			includeMCPOverview: false,
		} as any;

		const res = await mgr.buildContext(req, policy);
		expect(res.summaryText).not.toBeNull();
		expect(res.systemAugment).toContain("Conversation Summary");
	});

	test("no retrieval and no MCP overview yields minimal augment", async () => {
		const mgr = new ContextManager(plugin);
		const req = {
			sessionId: "s1",
			messages: [{ role: "user", content: "query" }],
			mcpSelection: { clientIds: ["c1"] },
		} as any;
		const policy = {
			summarizeOverTokens: 999999,
			historyMaxMessages: 5,
			retrieval: { enableVault: false, k: 0, snippetLength: 0 },
			includeMCPOverview: false,
		} as any;

		const res = await mgr.buildContext(req, policy);
		expect(res.metrics.retrievalCount).toBe(0);
		expect(res.systemAugment).not.toContain("Relevant Docs");
		expect(res.systemAugment).not.toContain("MCP Tools Available");
	});

	jest.mock("../../src/services/ContextStorageService", () => {
		return {
			ContextStorage: jest.fn().mockImplementation(() => ({
				readMemories: jest.fn(async () => [
					{ content: "Remember to test more" },
				]),
				readScratchpadRecent: jest.fn(async () => "## Goals\n- Ship tests"),
			})),
		};
	});

	test("scratchpad recent and memories are included when available", async () => {
		jest.resetModules();
		const { ContextManager: CM } = require("../../src/managers/ContextManager");
		const mgr = new CM(plugin);
		const req = {
			sessionId: "s1",
			messages: [{ role: "assistant", content: "hello" }],
		} as any;
		const policy = {
			summarizeOverTokens: 999999,
			historyMaxMessages: 10,
			retrieval: { enableVault: false, k: 0, snippetLength: 0 },
			includeMCPOverview: false,
		} as any;

		const res = await mgr.buildContext(req, policy);
		expect(res.systemAugment).toContain("Planning Scratchpad (recent)");
		expect(res.systemAugment).toContain("Memories:");
		expect(res.systemAugment).toContain("Remember to test more");
	});

	test("respects historyMaxMessages when trimming kept messages", async () => {
		const mgr = new ContextManager(plugin);
		const req = {
			sessionId: "s1",
			messages: [
				{ role: "user", content: "m1" },
				{ role: "assistant", content: "m2" },
				{ role: "user", content: "m3" },
			],
		} as any;
		const policy = {
			summarizeOverTokens: 999999,
			historyMaxMessages: 2,
			retrieval: { enableVault: false, k: 0, snippetLength: 0 },
			includeMCPOverview: false,
		} as any;

		const res = await mgr.buildContext(req, policy);
		expect(res.trimmedMessages.length).toBe(2);
		expect(res.trimmedMessages[0].content).toBe("m2");
		expect(res.trimmedMessages[1].content).toBe("m3");
	});
});
