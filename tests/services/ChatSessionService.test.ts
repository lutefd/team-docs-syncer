import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import type { App } from "obsidian";

const ensureScratchpadTemplateMock = jest.fn();
const deleteSessionNotesMock = jest.fn();
jest.mock("../../src/services/ContextStorageService", () => ({
	ContextStorage: jest.fn().mockImplementation(() => ({
		ensureScratchpadTemplate: (...args: any[]) =>
			ensureScratchpadTemplateMock(...args),
		deleteSessionNotes: (...args: any[]) => deleteSessionNotesMock(...args),
	})),
}));

describe("ChatSessionService", () => {
	let app: App;
	let plugin: any;
	let svc: any;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		app = createMockApp();
		plugin = createMockPlugin(app);
		const {
			ChatSessionService,
		} = require("../../src/services/ChatSessionService");
		svc = new ChatSessionService(plugin);
	});

	test("constructor creates initial active session and ensures scratchpad", () => {
		const list = svc.list();
		expect(list.length).toBe(1);
		const active = svc.getActive();
		expect(active).not.toBeNull();
		expect(ensureScratchpadTemplateMock).toHaveBeenCalledWith(active.id);
	});

	test("createSession unshifts, sets active, uses default and custom titles", () => {
		const firstId = svc.getActive().id;
		const s2 = svc.createSession();
		expect(svc.list()[0].id).toBe(s2.id);
		expect(svc.getActive().id).toBe(s2.id);
		expect(s2.title).toBe("New Chat");

		const s3 = svc.createSession("T");
		expect(s3.title).toBe("T");
		expect(ensureScratchpadTemplateMock).toHaveBeenCalledWith(s3.id);
		expect(svc.list().some((s: any) => s.id === firstId)).toBe(true);
	});

	test("setActive switches only if session exists", () => {
		const a = svc.createSession("A");
		const b = svc.createSession("B");
		svc.setActive(a.id);
		expect(svc.getActive().id).toBe(a.id);
		svc.setActive("missing");
		expect(svc.getActive().id).toBe(a.id);
		svc.setActive(b.id);
		expect(svc.getActive().id).toBe(b.id);
	});

	test("rename updates title when id exists", () => {
		const s = svc.getActive();
		svc.rename(s.id, "X");
		expect(svc.getActive().title).toBe("X");
		svc.rename("missing", "Y");
		expect(svc.getActive().title).toBe("X");
	});

	test("remove deletes session, calls deleteSessionNotes, and updates active", () => {
		const a = svc.getActive();
		const b = svc.createSession("B");
		const c = svc.createSession("C");

		svc.remove(c.id);
		expect(deleteSessionNotesMock).toHaveBeenCalledWith(c.id);
		expect(svc.list().find((s: any) => s.id === c.id)).toBeUndefined();
		expect(svc.getActive().id).not.toBe(c.id);

		svc.remove(a.id);
		expect(svc.list().find((s: any) => s.id === a.id)).toBeUndefined();
		expect([b.id]).toContain(svc.getActive().id);

		const remainingId = svc.getActive().id;
		svc.remove(remainingId);
		expect(svc.list().length).toBe(0);
		expect(svc.getActive()).not.toBeNull();
	});

	test("pin/unpin/getPinned on active session and no-op when no active match", () => {
		const s = svc.getActive();
		svc.pin("Team/Docs/a.md");
		svc.pin("Team/Docs/b.md");
		expect(new Set(svc.getPinned())).toEqual(
			new Set(["Team/Docs/a.md", "Team/Docs/b.md"])
		);

		(svc as any).activeId = "missing";
		svc.pin("Team/Docs/c.md");
		expect(new Set(svc.getPinned())).toEqual(new Set([]));

		(svc as any).activeId = s.id;
		svc.unpin("Team/Docs/a.md");
		expect(new Set(svc.getPinned())).toEqual(new Set(["Team/Docs/b.md"]));
	});

	test("compactHistory builds summary and keeps last N non-system, unique systems preserved", () => {
		const s = svc.getActive();
		s.messages = [
			{ role: "system", content: "A" },
			{ role: "system", content: "A" },
			{ role: "system", content: "Conversation summary so far:\nold" },
			{ role: "user", content: "m1" },
			{ role: "assistant", content: "m2" },
			{ role: "user", content: "m3" },
			{ role: "assistant", content: "m4" },
			{ role: "user", content: "m5" },
		];

		svc.compactHistory(s.id, "NEW", 3);

		const msgs = s.messages;
		expect(msgs[0].role).toBe("system");
		expect((msgs[0] as any).content).toBe("A");
		expect(
			msgs.some(
				(m: any) =>
					typeof m.content === "string" &&
					m.content.startsWith("Conversation summary so far:")
			)
		).toBe(true);

		const sysCount = msgs.filter((m: any) => m.role === "system").length;
		expect(sysCount).toBe(2);

		const nonSys = msgs.filter((m: any) => m.role !== "system");
		expect(nonSys.map((m: any) => m.content)).toEqual(["m3", "m4", "m5"]);
	});
});
