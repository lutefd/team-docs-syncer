import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import type { App } from "obsidian";

const generateTextMock = jest.fn();

timeoutJestConsoleNoise();

jest.mock("ai", () => ({
	generateText: (opts: any) => generateTextMock(opts),
}));

const shouldExtractMock = jest.fn();
jest.mock("../../src/utils/TaskHeuristics", () => ({
	shouldExtractMemories: (...args: any[]) => shouldExtractMock(...args),
}));

const readMemoriesMock = jest.fn();
const writeMemoriesMock = jest.fn();
jest.mock("../../src/services/ContextStorageService", () => ({
	ContextStorage: jest.fn().mockImplementation(() => ({
		readMemories: (...args: any[]) => readMemoriesMock(...args),
		writeMemories: (...args: any[]) => writeMemoriesMock(...args),
	})),
}));

function timeoutJestConsoleNoise() {
	const origError = console.error;
	const origWarn = console.warn;
	beforeAll(() => {
		console.error = (...args: any[]) => origError.apply(console, args);
		console.warn = (...args: any[]) => origWarn.apply(console, args);
	});
}

describe("MemoryService", () => {
	let app: App;
	let plugin: any;
	let svc: any;
	const FixedNow = 1000;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		jest.setSystemTime(new Date(FixedNow));
		jest.spyOn(Math, "random").mockReturnValue(0.42);

		app = createMockApp();
		plugin = createMockPlugin(app);

		const { MemoryService } = require("../../src/services/MemoryService");
		svc = new MemoryService(plugin);
	});

	afterEach(() => {
		jest.useRealTimers();
		(Math.random as any).mockRestore?.();
	});

	const model: any = { kind: "mock-model" };

	test("skips extraction when shouldExtractMemories returns false", async () => {
		shouldExtractMock.mockReturnValueOnce(false);

		await svc.extractAndStoreIfUseful("s1", "u", "a", model, 0, 0);

		expect(generateTextMock).not.toHaveBeenCalled();
		expect(readMemoriesMock).not.toHaveBeenCalled();
		expect(writeMemoriesMock).not.toHaveBeenCalled();

		expect(shouldExtractMock).toHaveBeenCalledWith("u", "a", 0, 0);
	});

	test("handles invalid JSON output gracefully (no writes)", async () => {
		shouldExtractMock.mockReturnValueOnce(true);
		generateTextMock.mockResolvedValueOnce({ text: "not json" });

		await svc.extractAndStoreIfUseful("s1", "u", "a", model, 1, 2);

		expect(readMemoriesMock).not.toHaveBeenCalled();
		expect(writeMemoriesMock).not.toHaveBeenCalled();
	});

	test("parses memories, trims, skips empty and duplicates, defaults type/tags, writes merged set", async () => {
		shouldExtractMock.mockReturnValueOnce(true);

		generateTextMock.mockResolvedValueOnce({
			text: JSON.stringify([
				{ content: "  Fact A  ", type: "fact", tags: ["tag1"] },
				{ content: "Pref B", type: "preference", tags: "oops" },
				{ content: "" },
				{ content: "Fact A" },
			]),
		});

		readMemoriesMock.mockResolvedValueOnce([
			{ id: "m1", type: "fact", content: "Existing", tags: [], createdAt: 1 },
			{
				id: "m2",
				type: "preference",
				content: "Pref B",
				tags: [],
				createdAt: 2,
			},
		]);

		await svc.extractAndStoreIfUseful(
			"s1",
			"u text",
			"assistant text",
			model,
			3,
			4
		);

		expect(generateTextMock).toHaveBeenCalled();

		expect(readMemoriesMock).toHaveBeenCalledWith("s1");
		expect(writeMemoriesMock).toHaveBeenCalledTimes(1);
		const out = writeMemoriesMock.mock.calls[0][1];

		const contents = out.map((m: any) => m.content);
		expect(contents).toEqual(["Existing", "Pref B", "Fact A"]);

		const newMem = out.find((m: any) => m.content === "Fact A");
		expect(newMem.type).toBe("fact");
		expect(newMem.tags).toEqual(["tag1"]);
		expect(newMem.createdAt).toBe(FixedNow);
		expect(newMem.id).toMatch(/^mem_1000_/);
	});

	test("passes correct prompt and model, slicing assistant to 1000 chars", async () => {
		shouldExtractMock.mockReturnValueOnce(true);

		const longAssistant = "x".repeat(1500);
		generateTextMock.mockResolvedValueOnce({ text: "[]" });

		await svc.extractAndStoreIfUseful(
			"s1",
			"user Q",
			longAssistant,
			model,
			0,
			0
		);

		const call = generateTextMock.mock.calls[0][0];
		expect(call.model).toBe(model);
		expect(call.temperature).toBe(0.1);
		expect(call.messages[0].role).toBe("system");
		expect(String(call.messages[0].content)).toContain("durable memories");

		expect(call.messages[1]).toEqual({
			role: "user",
			content: `user Q\n\nAssistant: ${"x".repeat(1000)}`,
		});
	});

	test("does not throw when storage operations fail; logs warning", async () => {
		shouldExtractMock.mockReturnValueOnce(true);
		generateTextMock.mockResolvedValueOnce({
			text: JSON.stringify([{ content: "A" }]),
		});
		readMemoriesMock.mockRejectedValueOnce(new Error("disk fail"));

		const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
		await expect(
			svc.extractAndStoreIfUseful("s1", "u", "a", model, 0, 0)
		).resolves.toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});
});
