import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import type { App } from "obsidian";
import { AiProvider } from "../../src/types/AiProvider";

const generateTextMock = jest.fn();

jest.mock("ai", () => ({
	generateText: (opts: any) => generateTextMock(opts),
}));

const factory = {
	hasValidApiKey: jest.fn(),
	getAvailableModels: jest.fn(),
	getAvailableProviders: jest.fn(),
	createModel: jest.fn(),
};

jest.mock("../../src/factories/AiProviderFactory", () => ({
	AiProviderFactory: jest.fn().mockImplementation(() => factory),
}));

describe("SummarizerService", () => {
	let app: App;
	let plugin: any;
	let SummarizerService: any;

	beforeEach(() => {
		jest.clearAllMocks();
		generateTextMock.mockReset();
		factory.hasValidApiKey.mockReset();
		factory.getAvailableModels.mockReset();
		factory.getAvailableProviders.mockReset();
		factory.createModel.mockReset();

		factory.hasValidApiKey.mockReturnValue(false);
		factory.getAvailableModels.mockReturnValue([]);
		factory.getAvailableProviders.mockReturnValue([]);
		factory.createModel.mockReturnValue({});
		generateTextMock.mockResolvedValue({ text: "" });

		app = createMockApp();
		plugin = createMockPlugin(app);
		({ SummarizerService } = require("../../src/services/SummarizerService"));
	});

	const mkMsgs = (n: number) =>
		Array.from({ length: n }, (_, i) => ({
			role: "user",
			content: String(i + 1),
		}));

	test("uses explicit provider/model options and returns trimmed text", async () => {
		const svc = new SummarizerService(plugin);
		factory.createModel.mockReturnValueOnce({ tag: "model" });
		generateTextMock.mockResolvedValueOnce({ text: "  summary  " });

		const res = await svc.summarize(mkMsgs(3), {
			provider: AiProvider.OPENAI,
			modelId: "gpt-x",
			targetTokens: 123,
		});

		expect(factory.createModel).toHaveBeenCalledWith(
			AiProvider.OPENAI,
			"gpt-x"
		);
		const call = generateTextMock.mock.calls[0][0];
		expect(call.model).toEqual({ tag: "model" });
		expect(call.temperature).toBe(0.1);
		expect(call.messages[0].role).toBe("system");
		expect(String(call.messages[0].content)).toContain("123 tokens or less");
		expect(call.messages.slice(1).map((m: any) => m.content)).toEqual([
			"1",
			"2",
			"3",
		]);

		expect(res).toBe("summary");
	});

	test("auto-picks lastUsedProvider+model when valid and available", async () => {
		const svc = new SummarizerService(plugin);
		plugin.settings.ai.lastUsedProvider = AiProvider.ANTHROPIC;
		plugin.settings.ai.lastUsedModels = {
			[AiProvider.ANTHROPIC]: "claude-xyz",
		} as any;

		factory.hasValidApiKey.mockImplementation(
			(p: any) => p === AiProvider.ANTHROPIC
		);
		factory.getAvailableModels.mockReturnValueOnce([
			{ id: "claude-xyz" },
			{ id: "other" },
		]);
		factory.createModel.mockReturnValueOnce({ m: 1 });
		generateTextMock.mockResolvedValueOnce({ text: "ok" });

		const res = await svc.summarize(mkMsgs(1), {} as any);

		expect(factory.createModel).toHaveBeenCalledWith(
			AiProvider.ANTHROPIC,
			"claude-xyz"
		);
		expect(res).toBe("ok");
	});

	test("auto-picks from availableProviders using lastForP match or first model", async () => {
		const svc = new SummarizerService(plugin);
		// lastUsedProvider present but invalid key forces fallback path
		plugin.settings.ai.lastUsedProvider = AiProvider.GOOGLE;
		plugin.settings.ai.lastUsedModels = { [AiProvider.OPENAI]: "gpt-y" } as any;

		factory.hasValidApiKey.mockReturnValue(false); // ensure lastUsed invalid
		factory.getAvailableProviders.mockReturnValueOnce([
			{
				provider: AiProvider.OPENAI,
				models: [{ id: "gpt-y" }, { id: "gpt-z" }],
			},
			{ provider: AiProvider.ANTHROPIC, models: [{ id: "claude-3" }] },
		]);

		factory.createModel.mockReturnValueOnce({ m: 2 });
		generateTextMock.mockResolvedValueOnce({ text: "ok2" });

		const res = await svc.summarize(mkMsgs(2), {} as any);

		expect(factory.createModel).toHaveBeenCalledWith(
			AiProvider.OPENAI,
			"gpt-y"
		);
		expect(res).toBe("ok2");
	});

	test("falls back to OPENAI default when no preferred and openai key available", async () => {
		const svc = new SummarizerService(plugin);
		plugin.settings.ai.lastUsedProvider = undefined as any;
		plugin.settings.openaiModel = "gpt-fallback";

		// Only the fallback OPENAI check should return true
		factory.hasValidApiKey.mockImplementation(
			(p: any) => p === AiProvider.OPENAI
		);
		factory.getAvailableProviders.mockReturnValueOnce([]);

		factory.createModel.mockReturnValueOnce({ m: 3 });
		generateTextMock.mockResolvedValueOnce({ text: "ok3" });

		const res = await svc.summarize(mkMsgs(2), {} as any);

		expect(factory.createModel).toHaveBeenCalledWith(
			AiProvider.OPENAI,
			"gpt-fallback"
		);
		expect(res).toBe("ok3");
	});

	test("returns null when no provider/model can be determined", async () => {
		const svc = new SummarizerService(plugin);
		plugin.settings.ai.lastUsedProvider = undefined as any;

		factory.hasValidApiKey.mockReturnValue(false);
		factory.getAvailableProviders.mockReturnValue([]);

		const res = await svc.summarize(mkMsgs(1), {} as any);
		expect(res).toBeNull();
		expect(factory.createModel).not.toHaveBeenCalled();
		expect(generateTextMock).not.toHaveBeenCalled();
	});

	test("message slicing limits to last 40 messages and default token target is 400", async () => {
		const svc = new SummarizerService(plugin);

		factory.createModel.mockReturnValueOnce({ m: 4 });
		generateTextMock.mockResolvedValueOnce({ text: "done" });

		const msgs = mkMsgs(45);
		await svc.summarize(msgs as any, {
			provider: AiProvider.OPENAI,
			modelId: "gpt",
		});

		const call = generateTextMock.mock.calls[0][0];
		expect(call.messages.length).toBe(41);
		const included = call.messages.slice(1).map((m: any) => m.content);
		expect(included[0]).toBe("6");
		expect(included[39]).toBe("45");
		expect(String(call.messages[0].content)).toContain("400 tokens or less");
	});

	test("returns null on error and logs warning", async () => {
		const svc = new SummarizerService(plugin);
		factory.createModel.mockReturnValueOnce({});
		generateTextMock.mockReset();
		generateTextMock.mockRejectedValueOnce(new Error("boom"));
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

		const res = await svc.summarize(mkMsgs(1), {
			provider: AiProvider.OPENAI,
			modelId: "gpt",
		});
		expect(res).toBeNull();
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});
