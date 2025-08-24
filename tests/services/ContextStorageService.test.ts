import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import type { App } from "obsidian";

describe("ContextStorageService", () => {
	let app: App;
	let plugin: any;
	let storage: any;
	let adapter: any;

	beforeEach(() => {
		app = createMockApp();
		plugin = createMockPlugin(app);
		adapter = {
			exists: jest.fn(async (_: string) => false),
			read: jest.fn(async (_: string) => ""),
			write: jest.fn(async (_: string, __: string) => {}),
			mkdir: jest.fn(async (_: string) => {}),
			remove: jest.fn(async (_: string) => {}),
		};
		(app as any).vault.adapter = adapter;
		const {
			ContextStorage,
		} = require("../../src/services/ContextStorageService");
		storage = new ContextStorage(plugin);
	});

	function sessionDir(id: string) {
		return `.obsidian/plugins/team-docs-syncer/plans/files_per_session/${id}`;
	}

	test("ensureScratchpadTemplate creates dir and writes template if missing", async () => {
		await storage.ensureScratchpadTemplate("s1");
		expect(adapter.mkdir).toHaveBeenCalledWith(sessionDir("s1"));
		expect(adapter.exists).toHaveBeenCalledWith(
			`${sessionDir("s1")}/scratchpad.md`
		);
		expect(adapter.write).toHaveBeenCalled();

		adapter.exists.mockResolvedValueOnce(true);
		adapter.write.mockClear();
		await storage.ensureScratchpadTemplate("s2");
		expect(adapter.write).not.toHaveBeenCalled();
	});

	test("updateScratchpadSection replaces existing section or appends when not present", async () => {
		const file = `${sessionDir("s1")}/scratchpad.md`;
		adapter.exists.mockResolvedValueOnce(true);
		adapter.read.mockResolvedValueOnce(
			`# Scratchpad\n\n## Goals\n- old\n\n## Plan\n- p`
		);
		await storage.updateScratchpadSection("s1", "Goals", "- new");
		expect(adapter.write).toHaveBeenCalledWith(
			file,
			expect.stringContaining("## Goals\n- new")
		);

		adapter.write.mockClear();
		adapter.exists.mockResolvedValueOnce(false);
		adapter.read.mockResolvedValueOnce("");
		await storage.updateScratchpadSection("s1", "Decisions", "- d1");
		expect(adapter.write).toHaveBeenCalledWith(
			file,
			expect.stringContaining("## Decisions\n- d1")
		);
	});

	test("appendScratchpad appends new block with timestamp or creates file", async () => {
		const file = `${sessionDir("s1")}/scratchpad.md`;

		adapter.exists.mockResolvedValueOnce(true);
		adapter.read.mockResolvedValueOnce("# Scratchpad\nold");
		await storage.appendScratchpad("s1", "some text");
		expect(adapter.write).toHaveBeenCalledWith(
			file,
			expect.stringContaining("some text")
		);
		expect(adapter.write.mock.calls[0][1]).toMatch(/## .*\nsome text/);

		adapter.exists.mockResolvedValueOnce(false);
		await storage.appendScratchpad("s1", "first");
		expect(adapter.write).toHaveBeenCalledWith(
			file,
			expect.stringContaining("# Scratchpad")
		);
	});

	test("readScratchpad returns null when missing and content when exists", async () => {
		const file = `${sessionDir("s1")}/scratchpad.md`;
		adapter.exists.mockResolvedValueOnce(false);
		expect(await storage.readScratchpad("s1")).toBeNull();

		adapter.exists.mockResolvedValueOnce(true);
		adapter.read.mockResolvedValueOnce("content");
		expect(await storage.readScratchpad("s1")).toBe("content");
		expect(adapter.read).toHaveBeenCalledWith(file);
	});

	test("writeScratchpad ensures dir and writes content", async () => {
		const file = `${sessionDir("s1")}/scratchpad.md`;
		await storage.writeScratchpad("s1", "C");
		expect(adapter.mkdir).toHaveBeenCalledWith(sessionDir("s1"));
		expect(adapter.write).toHaveBeenCalledWith(file, "C");
	});

	test("readScratchpadRecent returns header+lastN sections or full when few", async () => {
		const file = `${sessionDir("s1")}/scratchpad.md`;
		const full = `# Scratchpad\n\n## A\n1\n\n## B\n2\n\n## C\n3`;
		adapter.exists.mockResolvedValueOnce(true);
		adapter.read.mockResolvedValueOnce(full);
		const recent = await storage.readScratchpadRecent("s1", 2);
		expect(recent).toContain("# Scratchpad");
		expect(recent).toContain("## B");
		expect(recent).toContain("## C");

		adapter.exists.mockResolvedValueOnce(true);
		adapter.read.mockResolvedValueOnce(full);
		const all = await storage.readScratchpadRecent("s1", 5);
		expect(all).toBe(full);
	});

	test("writeSummary writes summary file; readSummary respects exists", async () => {
		const file = `${sessionDir("s1")}/summary.md`;
		await storage.writeSummary("s1", "SUM");
		expect(adapter.write).toHaveBeenCalledWith(
			file,
			expect.stringContaining("Conversation Summary")
		);

		adapter.exists.mockResolvedValueOnce(false);
		expect(await storage.readSummary("s1")).toBeNull();
		adapter.exists.mockResolvedValueOnce(true);
		adapter.read.mockResolvedValueOnce("S");
		expect(await storage.readSummary("s1")).toBe("S");
	});

	test("memories read/write and fallback to [] on errors or missing", async () => {
		const file = `${sessionDir("s1")}/memories.json`;
		await storage.writeMemories("s1", [{ a: 1 }]);
		expect(adapter.write).toHaveBeenCalledWith(
			file,
			JSON.stringify([{ a: 1 }], null, 2)
		);

		adapter.exists.mockResolvedValueOnce(true);
		adapter.read.mockResolvedValueOnce('[{"a":2}]');
		expect(await storage.readMemories("s1")).toEqual([{ a: 2 }]);

		adapter.exists.mockResolvedValueOnce(true);
		adapter.read.mockResolvedValueOnce("not-json");
		expect(await storage.readMemories("s1")).toEqual([]);

		adapter.exists.mockResolvedValueOnce(false);
		expect(await storage.readMemories("s1")).toEqual([]);
	});

	test("deleteSessionNotes removes scratchpad/summary if they exist", async () => {
		const scratch = `${sessionDir("s1")}/scratchpad.md`;
		const summary = `${sessionDir("s1")}/summary.md`;

		adapter.exists.mockResolvedValueOnce(true);
		adapter.exists.mockResolvedValueOnce(false);
		await storage.deleteSessionNotes("s1");

		expect(adapter.remove).toHaveBeenCalledWith(scratch);
		expect(adapter.remove).not.toHaveBeenCalledWith(summary);
	});
});
