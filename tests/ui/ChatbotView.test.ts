/** @jest-environment jsdom */
import { App, TFile } from "obsidian";
import { ChatbotView } from "../../src/ui/ChatbotView";
import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";

jest.mock("../../src/ui/components/MessageRenderer", () => {
	return {
		MessageRenderer: jest.fn().mockImplementation(() => ({
			renderMessages: jest.fn(async () => {}),
			renderMessage: jest.fn(() => {}),
			createStreamingMessage: jest.fn(() => {
				const contentEl = document.createElement("div");
				return {
					contentEl,
					setPlaceholder: jest.fn(),
					appendContent: (delta: string) => {
						contentEl.textContent = (contentEl.textContent || "") + delta;
					},
					addThinkingSection: jest.fn(),
					updateContent: (t: string) => (contentEl.textContent = t),
					finalize: jest.fn(async () => {}),
				};
			}),
			unload: jest.fn(),
		})),
	};
});

jest.mock("../../src/ui/components/LinkHandler", () => ({
	LinkHandler: jest.fn().mockImplementation(() => ({
		fixInternalLinks: jest.fn(),
		unload: jest.fn(),
	})),
}));

jest.mock("../../src/ui/components/ChatInput", () => ({
	ChatInput: jest.fn().mockImplementation((_container, _plugin, opts) => ({
		updateMode: jest.fn(),
		unload: jest.fn(),
		__opts: opts,
	})),
}));

jest.mock("../../src/managers/SessionManager", () => {
	const SessionManager: any = jest.fn().mockImplementation((_plugin, opts) => ({
		createSessionsButton: jest.fn((_header, _cb) => {}),
		createModeToggle: jest.fn((_header, _mode, cb) => {
			SessionManager.__modeToggle = cb;
		}),
		renderPins: jest.fn(),
		renderSources: jest.fn(),
		unload: jest.fn(),
	}));
	return { SessionManager };
});

jest.mock("../../src/ui/modals/EditTargetModal", () => ({
	EditTargetModal: jest
		.fn()
		.mockImplementation((_app, _plugin, _cands, cb) => ({
			open: () => cb("Picked.md"),
		})),
}));

jest.mock("../../src/ui/modals/DiffModal", () => ({
	DiffModal: jest
		.fn()
		.mockImplementation((_app, _path, _orig, _new, onConfirm) => ({
			open: () => onConfirm(true),
		})),
}));

jest.mock("../../src/instructions", () => ({
	buildComposeSystemPrompt: jest.fn(() => "SYS_COMPOSE"),
	buildEditSystemPrompt: jest.fn(() => "SYS_EDIT"),
	buildContextualPrompt: jest.fn(() => "ASSIST_PREP"),
	buildEditContextPrompt: jest.fn(() => "FILE_CTX"),
}));

declare const ResizeObserver: any;

describe("ChatbotView", () => {
	let app: App;
	let plugin: any;
	let stableLeaf: { openFile: jest.Mock };

	beforeEach(() => {
		(Element.prototype as any).empty = function () {
			this.innerHTML = "";
		};
		(Element.prototype as any).addClass = function (...cls: string[]) {
			cls.forEach((c) => this.classList.add(c));
		};
		(Element.prototype as any).removeClass = function (...cls: string[]) {
			cls.forEach((c) => this.classList.remove(c));
		};
		(Element.prototype as any).createDiv = function (opts?: any) {
			const el = document.createElement("div");
			if (typeof opts === "string") el.className = opts;
			else if (opts?.cls) el.className = opts.cls;
			this.appendChild(el);
			return el;
		};

		app = createMockApp();
		plugin = createMockPlugin(app);
		(global as any).__app = app;

		stableLeaf = { openFile: jest.fn() } as any;
		(app as any).workspace.getLeaf = jest.fn(() => stableLeaf as any);

		plugin.markdownIndexService = {
			init: jest.fn(async () => {}),
			search: jest.fn(() => []),
		};
		plugin.aiService = {
			hasApiKey: jest.fn(() => true),
			streamChat: jest.fn(async (_msgs: any, _mode: any, onDelta: any) => {
				onDelta("Hello");
				return { text: "Hello", sources: [] };
			}),
		};

		const session = { id: "s1", messages: [] as any[] };
		plugin.chatSessionService = {
			getActive: jest.fn(() => session),
			rename: jest.fn(),
			getPinned: jest.fn(() => []),
		};

		(global as any).ResizeObserver = class {
			cb: any;
			constructor(cb: any) {
				this.cb = cb;
			}
			observe() {}
			disconnect() {}
			trigger(width: number, el: HTMLElement) {
				this.cb([{ contentRect: { width }, target: el }]);
			}
		};
	});

	function makeView() {
		const leaf = {} as any;
		const view = new ChatbotView(leaf, plugin) as any;
		const parent = document.createElement("div");
		const child = document.createElement("div");
		parent.appendChild(document.createElement("div"));
		parent.appendChild(child);
		(view as any).containerEl = { children: [null, child] };
		return view;
	}

	test("onOpen renders and calls renderMessages when session exists", async () => {
		const view = makeView();
		await view.onOpen();

		expect(plugin.markdownIndexService.init).toHaveBeenCalled();
		expect(view.container.querySelector(".chatbot-header")).toBeTruthy();
		expect(view.container.querySelector(".chatbot-messages")).toBeTruthy();
		const MR = require("../../src/ui/components/MessageRenderer");
		const instance = MR.MessageRenderer.mock.results[0].value;
		expect(instance.renderMessages).toHaveBeenCalled();
	});

	test("handleSend without provider shows early return (no messages)", async () => {
		const view = makeView();
		await view.onOpen();

		const session = plugin.chatSessionService.getActive();
		expect(session.messages.length).toBe(0);

		await (view as any).handleSend("Hi");
		expect(session.messages.length).toBe(0);
		expect(plugin.aiService.streamChat).not.toHaveBeenCalled();
	});

	test("handleSend with missing API key returns early (no messages)", async () => {
		plugin.aiService.hasApiKey.mockReturnValue(false);
		const view = makeView();
		await view.onOpen();

		const session = plugin.chatSessionService.getActive();
		await (view as any).handleSend("Hi", {
			provider: "openai",
			modelId: "gpt",
		});
		expect(session.messages.length).toBe(0);
		expect(plugin.aiService.streamChat).not.toHaveBeenCalled();
	});

	test("compose flow streams and appends assistant message and handles proposals", async () => {
		const view = makeView();
		await view.onOpen();

		(app as any).vault.getAbstractFileByPath = jest.fn(
			() => new (TFile as any)("X.md")
		);
		(app as any).vault.read = jest.fn(async () => "old");
		(app as any).vault.modify = jest.fn(async () => {});

		plugin.aiService.streamChat.mockResolvedValueOnce({
			text: "Final",
			sources: ["S1"],
			proposals: [{ path: "X.md", content: "new" }],
		});

		const session = plugin.chatSessionService.getActive();
		await (view as any).handleSend("Hello world", {
			provider: "openai",
			modelId: "gpt",
		});

		expect(session.messages[0].role).toBe("user");
		expect(session.messages[1].role).toBe("assistant");

		await Promise.resolve();
		expect((app as any).vault.modify).toHaveBeenCalled();
	});

	test("chat mode mention attaches content to user message", async () => {
		const view = makeView();
		await view.onOpen();

		const SM = require("../../src/managers/SessionManager");
		SM.SessionManager.__modeToggle("chat");

		(app as any).vault.getAbstractFileByPath = jest.fn(
			(p: string) => new (TFile as any)(p)
		);
		(app as any).vault.read = jest.fn(
			async (file: any) => `content of ${file.path}`
		);

		const session = plugin.chatSessionService.getActive();
		await (view as any).handleSend(
			"Please read [[NoteA.md|AliasA]] and [[NoteB.md]]",
			{ provider: "openai", modelId: "gpt" }
		);

		const first = session.messages[0];
		expect(first.role).toBe("user");
		expect(first.content).toContain("Please read AliasA and NoteB");
		expect(first.content).toContain("<attachedcontent>");
		expect(first.content).toContain("File: NoteA.md");
		expect(first.content).toContain("File: NoteB.md");
	});

	test("generateEditWithStreamChat uses edit prompts and write mode", async () => {
		const view = makeView();
		await view.onOpen();

		(app as any).vault.getAbstractFileByPath = jest.fn(
			() => new (TFile as any)("Path.md")
		);

		await (view as any).generateEditWithStreamChat(
			"Path.md",
			{ provider: "openai", modelId: "gpt" },
			{ clientIds: [] }
		);

		expect(plugin.aiService.streamChat).toHaveBeenCalled();
		const args = plugin.aiService.streamChat.mock.calls.pop();
		expect(args[1]).toBe("write");
		const msgs = args[0];
		expect(Array.isArray(msgs)).toBe(true);
		expect(msgs[0]).toMatchObject({ role: "system" });
	});

	test("responsive classes toggled via ResizeObserver", async () => {
		const view = makeView();
		await view.onOpen();

		const container: HTMLElement = view.container;
		const ro: any = (view as any).resizeObserver;
		ro.trigger(360, container);
		expect(container.classList.contains("extremely-narrow")).toBe(true);
		ro.trigger(420, container);
		expect(container.classList.contains("very-narrow")).toBe(true);
		ro.trigger(600, container);
		expect(container.classList.contains("narrow")).toBe(true);
		ro.trigger(800, container);
		expect(
			container.classList.contains("narrow") ||
				container.classList.contains("very-narrow") ||
				container.classList.contains("extremely-narrow")
		).toBe(false);
	});

	test("openFile delegates to workspace leaf", async () => {
		const view = makeView();
		await view.onOpen();

		const file = new (TFile as any)("Doc.md");
		(app as any).vault.getAbstractFileByPath = jest.fn(() => file);
		await (view as any).openFile("Doc.md");
		expect(stableLeaf.openFile).toHaveBeenCalledWith(file);
	});
});
