import { createMockApp, createMockPlugin } from "../../helpers/mockPlugin";
import type { App } from "obsidian";

jest.mock("ai", () => ({
	tool: (def: any) => def,
}));

const withRetryMock = jest.fn(async (fn: any) => await fn());
jest.mock("../../../src/tools/core/utils", () => ({
	withRetry: (fn: any) => withRetryMock(fn),
}));

const storage = {
	readScratchpad: jest.fn(),
	updateScratchpadSection: jest.fn(),
	writeScratchpad: jest.fn(),
	appendScratchpad: jest.fn(),
	readMemories: jest.fn(),
	writeMemories: jest.fn(),
};

describe("planningTools", () => {
	let app: App;
	let plugin: any;
	let createPlanningTools: any;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		jest.doMock("../../../src/services/ContextStorageService", () => ({
			ContextStorage: jest.fn().mockImplementation(() => storage),
		}));

		({
			createPlanningTools,
		} = require("../../../src/tools/core/planningTools"));

		app = createMockApp();
		plugin = createMockPlugin(app);
		plugin.chatSessionService = { getActive: jest.fn(() => ({ id: "s1" })) };
	});

	describe("planning_read", () => {
		test("returns no session when there is no active session", async () => {
			plugin.chatSessionService.getActive.mockReturnValueOnce(null);
			const tools = createPlanningTools(plugin);
			const res = await tools.planning_read.execute();
			expect(res).toEqual({ ok: false, message: "No active session" });
			expect(storage.readScratchpad).not.toHaveBeenCalled();
		});

		test("reads scratchpad content when session exists", async () => {
			storage.readScratchpad.mockResolvedValueOnce("content");
			const tools = createPlanningTools(plugin);
			const res = await tools.planning_read.execute();
			expect(storage.readScratchpad).toHaveBeenCalledWith("s1");
			expect(res).toEqual({ ok: true, content: "content" });
			expect(withRetryMock).toHaveBeenCalled();
		});
	});

	describe("planning_update_section", () => {
		test("returns no session when there is no active session", async () => {
			plugin.chatSessionService.getActive.mockReturnValueOnce(null);
			const tools = createPlanningTools(plugin);
			const res = await tools.planning_update_section.execute({
				section: "Plan",
				content: "x",
			});
			expect(res).toEqual({ ok: false, message: "No active session" });
			expect(storage.updateScratchpadSection).not.toHaveBeenCalled();
		});

		test("updates specified section when session exists", async () => {
			const tools = createPlanningTools(plugin);
			const res = await tools.planning_update_section.execute({
				section: "Goals",
				content: "goals",
			});
			expect(storage.updateScratchpadSection).toHaveBeenCalledWith(
				"s1",
				"Goals",
				"goals"
			);
			expect(res).toEqual({ ok: true });
			expect(withRetryMock).toHaveBeenCalled();
		});
	});

	describe("planning_replace", () => {
		test("returns no session when there is no active session", async () => {
			plugin.chatSessionService.getActive.mockReturnValueOnce(null);
			const tools = createPlanningTools(plugin);
			const res = await tools.planning_replace.execute({ content: "full" });
			expect(res).toEqual({ ok: false, message: "No active session" });
			expect(storage.writeScratchpad).not.toHaveBeenCalled();
		});

		test("writes entire content when session exists", async () => {
			const tools = createPlanningTools(plugin);
			const res = await tools.planning_replace.execute({ content: "full" });
			expect(storage.writeScratchpad).toHaveBeenCalledWith("s1", "full");
			expect(res).toEqual({ ok: true });
		});
	});

	describe("planning_write", () => {
		test("returns no session when there is no active session", async () => {
			plugin.chatSessionService.getActive.mockReturnValueOnce(null);
			const tools = createPlanningTools(plugin);
			const res = await tools.planning_write.execute({ text: "note" });
			expect(res).toEqual({ ok: false, message: "No active session" });
			expect(storage.appendScratchpad).not.toHaveBeenCalled();
		});

		test("appends text when session exists", async () => {
			const tools = createPlanningTools(plugin);
			const res = await tools.planning_write.execute({ text: "note" });
			expect(storage.appendScratchpad).toHaveBeenCalledWith("s1", "note");
			expect(res).toEqual({ ok: true });
		});
	});

	describe("memories_add", () => {
		test("returns no session when there is no active session", async () => {
			plugin.chatSessionService.getActive.mockReturnValueOnce(null);
			const tools = createPlanningTools(plugin);
			const res = await tools.memories_add.execute({ content: "c" });
			expect(res).toEqual({ ok: false, message: "No active session" });
			expect(storage.writeMemories).not.toHaveBeenCalled();
		});

		test("creates new memory with defaults and writes list", async () => {
			jest.useFakeTimers().setSystemTime(new Date("2024-01-02T03:04:05Z"));
			const now = Date.now();
			storage.readMemories.mockResolvedValueOnce(undefined);

			const tools = createPlanningTools(plugin);
			const res = await tools.memories_add.execute({
				content: "Remember this",
			});

			expect(storage.readMemories).toHaveBeenCalledWith("s1");
			expect(storage.writeMemories).toHaveBeenCalledTimes(1);
			const written = storage.writeMemories.mock.calls[0][1];
			expect(written).toHaveLength(1);
			expect(written[0]).toEqual({
				id: `mem_${now}`,
				type: "fact",
				content: "Remember this",
				tags: [],
				createdAt: now,
			});
			expect(res).toEqual({ ok: true });
			jest.useRealTimers();
		});

		test("appends to existing memories and respects provided type/tags", async () => {
			jest.useFakeTimers().setSystemTime(1712345678901);
			storage.readMemories.mockResolvedValueOnce([
				{ id: "mem_1", type: "fact", content: "old", tags: [], createdAt: 1 },
			]);

			const tools = createPlanningTools(plugin);
			const res = await tools.memories_add.execute({
				content: "new",
				type: "entity",
				tags: ["a"],
			});

			const written = storage.writeMemories.mock.calls[0][1];
			expect(written).toHaveLength(2);
			expect(written[1].type).toBe("entity");
			expect(written[1].tags).toEqual(["a"]);
			expect(res).toEqual({ ok: true });
			jest.useRealTimers();
		});
	});

	describe("memories_list", () => {
		test("returns no session when there is no active session", async () => {
			plugin.chatSessionService.getActive.mockReturnValueOnce(null);
			const tools = createPlanningTools(plugin);
			const res = await tools.memories_list.execute({});
			expect(res).toEqual({ ok: false, message: "No active session" });
			expect(storage.readMemories).not.toHaveBeenCalled();
		});

		test("returns last N items with default limit 10", async () => {
			const items = Array.from({ length: 15 }, (_, i) => ({
				id: `mem_${i + 1}`,
				content: `${i + 1}`,
			}));
			storage.readMemories.mockResolvedValueOnce(items as any);

			const tools = createPlanningTools(plugin);
			const res = await tools.memories_list.execute({});
			expect(res.ok).toBe(true);
			expect(res.items.map((it: any) => it.id)).toEqual(
				items.slice(-10).map((it) => it.id)
			);
		});

		test("returns last limit items when provided", async () => {
			const items = Array.from({ length: 5 }, (_, i) => ({
				id: `mem_${i + 1}`,
				content: `${i + 1}`,
			}));
			storage.readMemories.mockResolvedValueOnce(items as any);

			const tools = createPlanningTools(plugin);
			const res = await tools.memories_list.execute({ limit: 3 });
			expect(res.ok).toBe(true);
			expect(res.items.map((it: any) => it.id)).toEqual(
				items.slice(-3).map((it) => it.id)
			);
		});
	});
});
