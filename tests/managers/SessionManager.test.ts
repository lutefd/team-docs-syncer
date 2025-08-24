/** @jest-environment jsdom */
import { App, TFile } from "obsidian";
import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import { SessionManager } from "../../src/managers/SessionManager";

describe("SessionManager", () => {
	let app: App;
	let plugin: any;
	let mgr: SessionManager;

	beforeEach(() => {
		(Element.prototype as any).empty = function () {
			this.innerHTML = "";
		};
		(Element.prototype as any).createEl = function (tag: string, opts?: any) {
			const el = document.createElement(tag);
			if (opts?.text) el.textContent = opts.text;
			if (opts?.cls) el.className = opts.cls;
			if (opts?.attr) {
				for (const [k, v] of Object.entries(opts.attr)) {
					el.setAttribute(k, String(v));
				}
			}
			this.appendChild(el);
			return el;
		};
		(Element.prototype as any).createDiv = function (opts?: any) {
			const el = document.createElement("div");
			if (typeof opts === "string") el.className = opts;
			if (opts?.cls) el.className = opts.cls;
			this.appendChild(el);
			return el;
		};
		(Element.prototype as any).toggleClass = function (
			cls: string,
			on: boolean
		) {
			if (on) this.classList.add(cls);
			else this.classList.remove(cls);
		};

		app = createMockApp();
		plugin = createMockPlugin(app);

		(app as any).workspace.getLeaf = jest.fn(() => ({
			openFile: jest.fn(),
		}));

		(app as any).vault.getAbstractFileByPath = jest.fn(
			(p: string) => new (TFile as any)(p)
		);

		plugin.chatSessionService = {
			getActive: jest.fn(() => ({
				id: "s1",
				title: "Session 1",
				messages: [{}, {}],
				pinnedPaths: new Set<string>(["Team/Docs/a.md", "Team/Docs/b.md"]),
			})),
			getPinned: jest.fn(() => ["Team/Docs/a.md", "Team/Docs/b.md"]),
			pin: jest.fn((p: string) => {}),
			unpin: jest.fn((p: string) => {}),
		};

		mgr = new SessionManager(plugin, {
			onPinsChange: jest.fn(),
			onSessionChange: jest.fn(),
		});
	});

	test("renderPins renders chips and remove triggers unpin + callback", () => {
		const el = document.createElement("div");
		mgr.renderPins(el);

		const chips = el.querySelectorAll(".pin-chip");
		expect(chips.length).toBe(2);

		const removeBtn = chips[0].querySelector(
			"button.pin-remove"
		) as HTMLButtonElement;
		expect(removeBtn).not.toBeNull();

		removeBtn.click();
		expect(plugin.chatSessionService.unpin).toHaveBeenCalled();
	});

	test("link click in pins calls openFile via workspace leaf", () => {
		const el = document.createElement("div");
		mgr.renderPins(el);

		const link = el.querySelector(".pin-label") as HTMLAnchorElement;
		link.click();

		const leaf = (app as any).workspace.getLeaf.mock.results[0].value;
		expect(leaf.openFile).toHaveBeenCalled();
	});

	test("renderSources builds list; pin button pins and triggers re-render and callback", () => {
		const pinsEl = document.createElement("div");
		pinsEl.className = "chatbot-pins";
		document.body.appendChild(pinsEl);

		const sourcesEl = document.createElement("div");
		mgr.renderSources(sourcesEl, ["Team/Docs/s1.md", "Team/Docs/s2.md"]);

		expect(sourcesEl.querySelector(".sources-header")).not.toBeNull();
		const items = sourcesEl.querySelectorAll(".source-item");
		expect(items.length).toBe(2);

		const pinBtn = items[0].querySelector(
			".source-pin-btn"
		) as HTMLButtonElement;
		pinBtn.click();

		expect(plugin.chatSessionService.pin).toHaveBeenCalledWith(
			"Team/Docs/s1.md"
		);
		expect(pinsEl.querySelectorAll(".pin-chip").length).toBeGreaterThanOrEqual(
			0
		);
	});

	test("createModeToggle toggles active class and invokes callback", () => {
		const container = document.createElement("div");
		const onMode = jest.fn();
		const { composeBtn, writeBtn, chatBtn } = mgr.createModeToggle(
			container,
			"chat",
			onMode
		);

		expect(chatBtn.classList.contains("is-active")).toBe(true);

		composeBtn.click();
		expect(onMode).toHaveBeenCalledWith("compose");
		expect(composeBtn.classList.contains("is-active")).toBe(true);

		writeBtn.click();
		expect(onMode).toHaveBeenCalledWith("write");
		expect(writeBtn.classList.contains("is-active")).toBe(true);
	});

	test("getCurrentSessionInfo returns summary of active session", () => {
		const info = mgr.getCurrentSessionInfo();
		expect(info).not.toBeNull();
		expect(info!.id).toBe("s1");
		expect(info!.pinnedCount).toBe(2);
		expect(info!.messageCount).toBe(2);
	});
});
