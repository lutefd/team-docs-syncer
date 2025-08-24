import { AiService } from "../../src/services/AiService";
import { AiProvider } from "../../src/types/AiProvider";
import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import type { App } from "obsidian";

const streamTextMock = jest.fn();
const generateTextMock = jest.fn();

jest.mock("@ai-sdk/openai", () => ({
	createOpenAI: jest.fn((opts: any) => (modelId: string) => ({
		kind: "openai",
		modelId,
		apiKey: opts.apiKey,
	})),
}));

jest.mock("ai", () => ({
	streamText: (opts: any) => streamTextMock(opts),
	generateText: (args: any) => generateTextMock(args),
}));

jest.mock("../../src/tools", () => ({
	buildTools: jest.fn(() => ({
		base_tool: { description: "base", execute: jest.fn() },
	})),
}));

const factoryCreateModel = jest.fn(() => ({ kind: "factoryModel" }));
const factoryHasKey = jest.fn(() => true);
jest.mock("../../src/factories/AiProviderFactory", () => ({
	AiProviderFactory: jest.fn().mockImplementation(() => ({
		createModel: factoryCreateModel,
		hasValidApiKey: factoryHasKey,
	})),
}));

jest.mock("../../src/instructions", () => ({
	buildSystemPrompt: jest.fn(() => "SYS"),
}));

jest.mock("../../src/utils/PathUtils", () => ({
	PathUtils: {
		getAiScope: jest.fn(() => "team-docs"),
	},
}));

const buildContextMock = jest.fn();
jest.mock("../../src/managers/ContextManager", () => ({
	ContextManager: jest.fn().mockImplementation(() => ({
		buildContext: (...args: any[]) => buildContextMock(...args),
	})),
}));

const writeSummaryMock = jest.fn();
jest.mock("../../src/services/ContextStorageService", () => ({
	ContextStorage: jest.fn().mockImplementation(() => ({
		writeSummary: (...args: any[]) => writeSummaryMock(...args),
	})),
}));

const summarizeMock = jest.fn();
jest.mock("../../src/services/SummarizerService", () => ({
	SummarizerService: jest.fn().mockImplementation(() => ({
		summarize: (...args: any[]) => summarizeMock(...args),
	})),
}));

const planIfUsefulMock = jest.fn();
const nextIfUsefulMock = jest.fn();
jest.mock("../../src/services/PlanningService", () => ({
	PlanningService: jest.fn().mockImplementation(() => ({
		generatePlanIfUseful: (...args: any[]) => planIfUsefulMock(...args),
		generateNextIfUseful: (...args: any[]) => nextIfUsefulMock(...args),
	})),
}));

const memoryExtractMock = jest.fn();
jest.mock("../../src/services/MemoryService", () => ({
	MemoryService: jest.fn().mockImplementation(() => ({
		extractAndStoreIfUseful: (...args: any[]) => memoryExtractMock(...args),
	})),
}));

describe("AiService", () => {
	let app: App;
	let plugin: any;
	let svc: AiService;

	beforeEach(() => {
		jest.clearAllMocks();
		app = createMockApp();
		plugin = createMockPlugin(app);
		plugin.chatSessionService = {
			getActive: jest.fn(() => ({ id: "s1" })),
			compactHistory: jest.fn(),
		};
		plugin.mcpManager = {
			listAllTools: jest.fn(async () => [
				{ clientId: "c1", clientName: "Client 1", tools: [{ name: "tool-a" }] },
			]),
			getConnectedClients: jest.fn(() => [
				{
					id: "c1",
					name: "Client 1",
					client: {
						tools: jest.fn(async () => ({
							mcp_tool: { description: "ok", execute: jest.fn() },
						})),
					},
				},
			]),
		};
		(plugin.settings as any).openaiApiKey = "sk-legacy";
		svc = new AiService(plugin);
	});

	test("hasApiKey: default legacy key and provider via factory", () => {
		expect(svc.hasApiKey()).toBe(true);

		factoryHasKey.mockReturnValueOnce(false);
		expect(svc.hasApiKey(AiProvider.OPENAI)).toBe(false);
		expect(factoryHasKey).toHaveBeenCalled();
	});

	test("streamChat: basic streaming collects text, sources, proposals, creations, thoughts and statuses", async () => {
		buildContextMock.mockResolvedValueOnce({
			systemAugment: "CTX",
			trimmedMessages: [{ role: "user", content: "Hi" }],
			summaryText: null,
			metrics: {
				summarized: false,
				retrievalCount: 0,
				inputTokensEstimated: 10,
				prunedTokens: 0,
			},
		});

		streamTextMock.mockImplementation((opts: any) => {
			opts.onStepFinish?.({
				toolCalls: [
					{ toolName: "search_docs" },
					{ toolName: "propose_edit" },
					{ toolName: "create_doc" },
				],
				toolResults: [
					{ toolName: "search_docs", output: [{ path: "Team/Docs/a.md" }] },
					{
						toolName: "propose_edit",
						output: { ok: true, path: "Team/Docs/p.md", content: "edits" },
					},
					{
						toolName: "create_doc",
						output: { ok: true, path: "Team/Docs/c.md", content: "new" },
					},
				],
			});

			const textStream = (async function* () {
				yield "<finalAnswer>";
				yield "Hello";
				yield "</finalAnswer>";
			})();

			const fullStream = (async function* () {
				yield { type: "reasoning", text: "thinking.." };
				yield { type: "reasoning-part-finish" };
			})();

			(streamTextMock as any).lastOptions = opts;
			return {
				textStream,
				fullStream,
				reasoningText: Promise.resolve("Because"),
			};
		});

		const deltas: string[] = [];
		const statuses: string[] = [];
		const thoughts: string[] = [];

		const res = await svc.streamChat(
			[{ role: "user", content: "Hi" }],
			"chat",
			(d) => deltas.push(d),
			(s) => statuses.push(s),
			(t) => thoughts.push(t),
			(p) => {},
			AiProvider.OPENAI,
			"gpt-x",
			{ clientIds: ["c1"] }
		);

		expect(deltas.join("")).toContain("Hello");
		expect(res.text).toContain("Hello");
		expect(res.sources).toContain("Team/Docs/a.md");
		expect(res.proposals?.[0].path).toBe("Team/Docs/p.md");
		expect(res.creations?.[0].path).toBe("Team/Docs/c.md");
		expect(res.thoughts).toBeDefined();
		expect(statuses.length).toBeGreaterThan(0);

		expect((streamTextMock as any).lastOptions.tools).toBeUndefined();
		expect((streamTextMock as any).lastOptions.messages[0].role).toBe("system");
	});

	test("streamChat: fallback generateText when no text but tool results exist", async () => {
		buildContextMock.mockResolvedValueOnce({
			systemAugment: "CTX",
			trimmedMessages: [{ role: "user", content: "Hi" }],
			summaryText: null,
			metrics: {
				summarized: false,
				retrievalCount: 0,
				inputTokensEstimated: 10,
				prunedTokens: 0,
			},
		});

		streamTextMock.mockImplementation((opts: any) => {
			opts.onStepFinish?.({
				toolCalls: [{ toolName: "search_docs" }],
				toolResults: [
					{ toolName: "search_docs", output: [{ path: "Team/Docs/a.md" }] },
				],
			});
			const textStream = (async function* () {})();
			const fullStream = (async function* () {})();
			return {
				textStream,
				fullStream,
				reasoningText: Promise.resolve(undefined),
			};
		});

		generateTextMock.mockResolvedValueOnce({ text: "Fallback answer" });

		const res = await svc.streamChat(
			[{ role: "user", content: "Hi" }],
			"chat",
			() => {},
			undefined,
			undefined,
			undefined,
			AiProvider.OPENAI,
			"gpt-x",
			undefined
		);

		expect(generateTextMock).toHaveBeenCalled();
		expect(res.text).toBe("Fallback answer");
		expect(res.sources).toContain("Team/Docs/a.md");
	});

	test("streamChat: summarized path writes provisional and refined summaries and compacts history", async () => {
		buildContextMock.mockResolvedValueOnce({
			systemAugment: "CTX",
			trimmedMessages: [{ role: "user", content: "Hi" }],
			summaryText: "SUMMARIZED",
			metrics: {
				summarized: true,
				retrievalCount: 0,
				inputTokensEstimated: 10,
				prunedTokens: 0,
			},
		});

		summarizeMock.mockResolvedValueOnce("REFINED");
		streamTextMock.mockImplementation(() => {
			const textStream = (async function* () {
				yield "<finalAnswer>ok</finalAnswer>";
			})();
			const fullStream = (async function* () {})();
			return { textStream, fullStream, reasoningText: Promise.resolve("") };
		});

		await svc.streamChat([{ role: "user", content: "Hi" }], "chat", () => {});

		expect(writeSummaryMock).toHaveBeenCalledWith("s1", "SUMMARIZED");
		expect(plugin.chatSessionService.compactHistory).toHaveBeenCalled();

		await Promise.resolve();
		expect(summarizeMock).toHaveBeenCalled();
	});

	test("compose mode merges MCP tools into base tools when selected", async () => {
		buildContextMock.mockResolvedValueOnce({
			systemAugment: "CTX",
			trimmedMessages: [{ role: "user", content: "Hi" }],
			summaryText: null,
			metrics: {
				summarized: false,
				retrievalCount: 0,
				inputTokensEstimated: 10,
				prunedTokens: 0,
			},
		});

		streamTextMock.mockImplementation((opts: any) => {
			(streamTextMock as any).lastOptions = opts;
			const textStream = (async function* () {
				yield "<finalAnswer>ok</finalAnswer>";
			})();
			const fullStream = (async function* () {})();
			return { textStream, fullStream, reasoningText: Promise.resolve("") };
		});

		await svc.streamChat(
			[{ role: "user", content: "Hi" }],
			"compose",
			() => {},
			undefined,
			undefined,
			undefined,
			AiProvider.OPENAI,
			"gpt-x",
			{ clientIds: ["c1"] }
		);

		const tools = (streamTextMock as any).lastOptions.tools;
		expect(tools).toBeDefined();
		expect(Object.keys(tools)).toContain("base_tool");
		expect(Object.keys(tools)).toContain("mcp_tool");
	});

	test("buildSystemPrompt receives MCP tool info for selected clients", async () => {
		buildContextMock.mockResolvedValueOnce({
			systemAugment: "CTX",
			trimmedMessages: [{ role: "user", content: "Hi" }],
			summaryText: null,
			metrics: {
				summarized: false,
				retrievalCount: 0,
				inputTokensEstimated: 10,
				prunedTokens: 0,
			},
		});

		streamTextMock.mockImplementation(() => {
			const textStream = (async function* () {
				yield "<finalAnswer>ok</finalAnswer>";
			})();
			const fullStream = (async function* () {})();
			return { textStream, fullStream, reasoningText: Promise.resolve("") };
		});

		await svc.streamChat(
			[{ role: "user", content: "Hi" }],
			"chat",
			() => {},
			undefined,
			undefined,
			undefined,
			AiProvider.OPENAI,
			"gpt-x",
			{ clientIds: ["c1"] }
		);

		const { buildSystemPrompt } = require("../../src/instructions");
		expect(buildSystemPrompt).toHaveBeenCalled();
		const lastArgs = (buildSystemPrompt as jest.Mock).mock.calls.pop()?.[0];
		expect(lastArgs.mcpTools?.length).toBe(1);
		expect(lastArgs.mcpTools?.[0].clientId).toBe("c1");
	});
});
