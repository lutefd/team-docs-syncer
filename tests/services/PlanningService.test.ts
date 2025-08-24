import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import type { App } from "obsidian";

const generateTextMock = jest.fn();

jest.mock("ai", () => ({
	generateText: (opts: any) => generateTextMock(opts),
}));

const shouldAutoPlanMock = jest.fn();
jest.mock("../../src/utils/TaskHeuristics", () => ({
	shouldAutoPlan: (...args: any[]) => shouldAutoPlanMock(...args),
}));

const ensureScratchpadTemplateMock = jest.fn();
const updateScratchpadSectionMock = jest.fn();
jest.mock("../../src/services/ContextStorageService", () => ({
	ContextStorage: jest.fn().mockImplementation(() => ({
		ensureScratchpadTemplate: (...args: any[]) =>
			ensureScratchpadTemplateMock(...args),
		updateScratchpadSection: (...args: any[]) =>
			updateScratchpadSectionMock(...args),
	})),
}));

describe("PlanningService", () => {
	let app: App;
	let plugin: any;
	let svc: any;

	beforeEach(() => {
		jest.clearAllMocks();
		app = createMockApp();
		plugin = createMockPlugin(app);

		const { PlanningService } = require("../../src/services/PlanningService");
		svc = new PlanningService(plugin);
	});

	const model: any = { kind: "mock-model" };

	describe("generatePlanIfUseful", () => {
		test("returns early when lastUserText is empty (no shouldAutoPlan)", async () => {
			await svc.generatePlanIfUseful("s1", "", model);
			expect(shouldAutoPlanMock).not.toHaveBeenCalled();
			expect(generateTextMock).not.toHaveBeenCalled();
			expect(ensureScratchpadTemplateMock).not.toHaveBeenCalled();
			expect(updateScratchpadSectionMock).not.toHaveBeenCalled();
		});

		test("skips when shouldAutoPlan is false", async () => {
			shouldAutoPlanMock.mockReturnValueOnce(false);
			await svc.generatePlanIfUseful("s1", "please do X", model);
			expect(shouldAutoPlanMock).toHaveBeenCalledWith("please do X");
			expect(generateTextMock).not.toHaveBeenCalled();
			expect(ensureScratchpadTemplateMock).not.toHaveBeenCalled();
			expect(updateScratchpadSectionMock).not.toHaveBeenCalled();
		});

		test("ensures scratchpad, sends prompt, trims text, and writes plan", async () => {
			shouldAutoPlanMock.mockReturnValueOnce(true);
			generateTextMock.mockResolvedValueOnce({
				text: "  - step 1\n- step 2  ",
			});

			await svc.generatePlanIfUseful("S", "make a plan", model);

			expect(ensureScratchpadTemplateMock).toHaveBeenCalledWith("S");
			expect(generateTextMock).toHaveBeenCalled();
			const call = generateTextMock.mock.calls[0][0];
			expect(call.model).toBe(model);
			expect(call.temperature).toBe(0.1);
			expect(call.messages[0].role).toBe("system");
			expect(String(call.messages[0].content)).toContain("bullet steps");
			expect(call.messages[1]).toEqual({
				role: "user",
				content: "make a plan",
			});

			expect(updateScratchpadSectionMock).toHaveBeenCalledWith(
				"S",
				"Plan",
				"- step 1\n- step 2"
			);
		});

		test("does not update when model returns empty/whitespace", async () => {
			shouldAutoPlanMock.mockReturnValueOnce(true);
			generateTextMock.mockResolvedValueOnce({ text: "   \n\t  " });

			await svc.generatePlanIfUseful("S", "make a plan", model);

			expect(updateScratchpadSectionMock).not.toHaveBeenCalled();
		});

		test("swallows errors and logs warning", async () => {
			shouldAutoPlanMock.mockReturnValueOnce(true);
			generateTextMock.mockRejectedValueOnce(new Error("llm fail"));
			const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

			await expect(
				svc.generatePlanIfUseful("S", "make a plan", model)
			).resolves.toBeUndefined();
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
		});
	});

	describe("generateNextIfUseful", () => {
		test("returns early when lastUserText is empty (no shouldAutoPlan)", async () => {
			await svc.generateNextIfUseful("s1", "", "assistant", model);
			expect(shouldAutoPlanMock).not.toHaveBeenCalled();
			expect(generateTextMock).not.toHaveBeenCalled();
			expect(updateScratchpadSectionMock).not.toHaveBeenCalled();
			expect(ensureScratchpadTemplateMock).not.toHaveBeenCalled();
		});

		test("skips when shouldAutoPlan is false", async () => {
			shouldAutoPlanMock.mockReturnValueOnce(false);
			await svc.generateNextIfUseful("s1", "please do X", "thanks", model);
			expect(shouldAutoPlanMock).toHaveBeenCalledWith("please do X");
			expect(generateTextMock).not.toHaveBeenCalled();
			expect(updateScratchpadSectionMock).not.toHaveBeenCalled();
			expect(ensureScratchpadTemplateMock).not.toHaveBeenCalled();
		});

		test("sends prompt with clipped assistant to 1000 chars and writes Next section", async () => {
			shouldAutoPlanMock.mockReturnValueOnce(true);
			const longAssistant = "x".repeat(1500);
			generateTextMock.mockResolvedValueOnce({ text: "- next 1\n- next 2" });

			await svc.generateNextIfUseful("S", "question?", longAssistant, model);

			expect(generateTextMock).toHaveBeenCalled();
			const call = generateTextMock.mock.calls[0][0];
			expect(call.model).toBe(model);
			expect(call.temperature).toBe(0.1);
			expect(call.messages[0].role).toBe("system");
			expect(String(call.messages[0].content)).toContain(
				"immediate next actions"
			);

			expect(call.messages[1]).toEqual({
				role: "user",
				content: `question?\n\nAssistant: ${"x".repeat(1000)}`,
			});

			expect(updateScratchpadSectionMock).toHaveBeenCalledWith(
				"S",
				"Next",
				"- next 1\n- next 2"
			);
			expect(ensureScratchpadTemplateMock).not.toHaveBeenCalled();
		});

		test("does not update when model returns empty/whitespace", async () => {
			shouldAutoPlanMock.mockReturnValueOnce(true);
			generateTextMock.mockResolvedValueOnce({ text: "   " });

			await svc.generateNextIfUseful("S", "question?", "assistant", model);
			expect(updateScratchpadSectionMock).not.toHaveBeenCalled();
		});

		test("swallows errors and logs warning", async () => {
			shouldAutoPlanMock.mockReturnValueOnce(true);
			generateTextMock.mockRejectedValueOnce(new Error("llm fail"));
			const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

			await expect(
				svc.generateNextIfUseful("S", "question?", "assistant", model)
			).resolves.toBeUndefined();
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
		});
	});
});
