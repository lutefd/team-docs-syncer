/** @jest-environment jsdom */
import { App } from "obsidian";
import { createMockApp, createMockPlugin } from "../../helpers/mockPlugin";
import { ChatSessionsModal } from "../../../src/ui/modals/ChatSessionsModal";

beforeEach(() => {
	(Element.prototype as any).empty = function () {
		this.innerHTML = "";
	};
	(Element.prototype as any).addClass = function (cls: string) {
		this.classList.add(cls);
	};
	(Element.prototype as any).createDiv = function (opts?: any) {
		const el = document.createElement("div");
		if (typeof opts === "string") el.className = opts;
		else if (opts?.cls) el.className = opts.cls;
		this.appendChild(el);
		return el;
	};
	(Element.prototype as any).createEl = function (tag: string, opts?: any) {
		const el = document.createElement(tag);
		if (opts?.text) el.textContent = opts.text;
		if (opts?.cls) el.className = opts.cls;
		this.appendChild(el);
		return el;
	};
	(Element.prototype as any).createSpan = function (opts?: any) {
		const el = document.createElement("span");
		if (typeof opts === "string") el.className = opts;
		else if (opts?.cls) el.className = opts.cls;
		if (opts?.text) el.textContent = opts.text;
		this.appendChild(el);
		return el;
	};
});

describe("ChatSessionsModal", () => {
	let app: App;
	let plugin: any;
	let modal: ChatSessionsModal;
	let sessions: Array<{ id: string; title: string }>;
	let onChange: jest.Mock;

	beforeEach(() => {
		app = createMockApp();
		plugin = createMockPlugin(app);

		sessions = [
			{ id: "1", title: "First" },
			{ id: "2", title: "Second" },
		];
		plugin.chatSessionService = {
			list: jest.fn(() => sessions.slice()),
			setActive: jest.fn(),
			rename: jest.fn((id: string, name: string) => {
				const s = sessions.find((x) => x.id === id);
				if (s) s.title = name;
			}),
			remove: jest.fn((id: string) => {
				sessions = sessions.filter((s) => s.id !== id);
			}),
			createSession: jest.fn(() => {
				const id = (sessions.length + 1).toString();
				sessions.push({ id, title: `Session ${id}` });
				return id;
			}),
			setActiveId: null,
		};

		onChange = jest.fn();
		modal = new ChatSessionsModal(app, plugin, onChange);
	});

	function openModal() {
		modal.onOpen();
	}

	test("renders list with actions for each session", () => {
		openModal();
		const list = (modal as any).contentEl.querySelector(
			".chat-sessions-list"
		) as HTMLElement;
		const rows = Array.from(list.querySelectorAll(".chat-session-row"));
		expect(rows.length).toBe(2);

		expect((rows[0].querySelector("span") as HTMLElement).textContent).toBe(
			"First"
		);
		expect((rows[1].querySelector("span") as HTMLElement).textContent).toBe(
			"Second"
		);

		const btns = Array.from(
			rows[0].querySelectorAll("button")
		) as HTMLButtonElement[];
		expect(btns.map((b) => b.textContent)).toEqual([
			"Open",
			"Rename",
			"Delete",
		]);
	});

	test("Open sets active session, calls onChange and closes", () => {
		openModal();
		const firstRow = (modal as any).contentEl.querySelectorAll(
			".chat-session-row"
		)[0] as HTMLElement;
		const [openBtn] = Array.from(
			firstRow.querySelectorAll("button")
		) as HTMLButtonElement[];
		openBtn.click();

		expect(plugin.chatSessionService.setActive).toHaveBeenCalledWith("1");
		expect(onChange).toHaveBeenCalled();
	});

	test("Rename prompts for new name, updates service and re-renders list", () => {
		openModal();
		let firstRow = (modal as any).contentEl.querySelectorAll(
			".chat-session-row"
		)[0] as HTMLElement;
		const [, renameBtn] = Array.from(
			firstRow.querySelectorAll("button")
		) as HTMLButtonElement[];

		const promptSpy = jest.spyOn(window, "prompt").mockReturnValue("Renamed");
		renameBtn.click();
		expect(plugin.chatSessionService.rename).toHaveBeenCalledWith(
			"1",
			"Renamed"
		);
		expect(onChange).toHaveBeenCalled();

		const list = (modal as any).contentEl.querySelector(
			".chat-sessions-list"
		) as HTMLElement;
		firstRow = list.querySelectorAll(".chat-session-row")[0] as HTMLElement;
		const title = (firstRow.querySelector("span") as HTMLElement).textContent;
		expect(title).toBe("Renamed");
		promptSpy.mockRestore();
	});

	test("Delete confirms and removes, re-renders and calls onChange", () => {
		openModal();
		const listBefore = (modal as any).contentEl.querySelector(
			".chat-sessions-list"
		) as HTMLElement;
		expect(listBefore.querySelectorAll(".chat-session-row").length).toBe(2);

		const firstRow = listBefore.querySelectorAll(
			".chat-session-row"
		)[0] as HTMLElement;
		const btns = Array.from(
			firstRow.querySelectorAll("button")
		) as HTMLButtonElement[];

		const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
		btns[2].click();

		const listAfter = (modal as any).contentEl.querySelector(
			".chat-sessions-list"
		) as HTMLElement;
		expect(listAfter.querySelectorAll(".chat-session-row").length).toBe(1);
		expect(plugin.chatSessionService.remove).toHaveBeenCalledWith("1");
		expect(onChange).toHaveBeenCalled();
		confirmSpy.mockRestore();
	});

	test("Create adds a new session and re-renders", () => {
		openModal();
		const createBtn = Array.from(
			(modal as any).contentEl.querySelectorAll("button")
		).find(
			(b: HTMLButtonElement) => b.textContent === "Create"
		) as HTMLButtonElement;
		expect(createBtn).toBeTruthy();

		createBtn.click();
		expect(plugin.chatSessionService.createSession).toHaveBeenCalled();

		const list = (modal as any).contentEl.querySelector(
			".chat-sessions-list"
		) as HTMLElement;
		expect(list.querySelectorAll(".chat-session-row").length).toBe(3);
		expect(onChange).toHaveBeenCalled();
	});
});
