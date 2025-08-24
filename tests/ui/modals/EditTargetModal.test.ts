/** @jest-environment jsdom */
import { App, TFolder, TFile } from "obsidian";
import { createMockApp, createMockPlugin } from "../../helpers/mockPlugin";
import { EditTargetModal } from "../../../src/ui/modals/EditTargetModal";

beforeEach(() => {
	(Element.prototype as any).empty = function () {
		this.innerHTML = "";
	};
	(Element.prototype as any).addClass = function (cls: string) {
		this.classList.add(cls);
	};
	(Element.prototype as any).removeClass = function (cls: string) {
		this.classList.remove(cls);
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
		if (opts?.attr)
			Object.entries(opts.attr).forEach(([k, v]) =>
				(el as any).setAttribute(k, String(v))
			);
		this.appendChild(el);
		return el;
	};
});

describe("EditTargetModal", () => {
	let app: App;
	let plugin: any;

	function buildVaultTree(teamRoot: string) {
		const root = new (TFolder as any)(teamRoot) as any as TFolder & {
			children: any[];
		};
		const sub = new (TFolder as any)(`${teamRoot}/sub`) as any as TFolder & {
			children: any[];
		};
		(root as any).children = [];
		(sub as any).children = [];

		const f1 = new (TFile as any)(`${teamRoot}/note1.md`) as any as TFile & {
			extension: string;
		};
		(f1 as any).extension = "md";
		const f2 = new (TFile as any)(`${teamRoot}/note2.md`) as any as TFile & {
			extension: string;
		};
		(f2 as any).extension = "md";
		const f3 = new (TFile as any)(
			`${teamRoot}/sub/nested.md`
		) as any as TFile & { extension: string };
		(f3 as any).extension = "md";

		(root as any).children.push(f1, f2, sub);
		(sub as any).children.push(f3);

		return { root, sub, files: [f1, f2, f3] };
	}

	beforeEach(() => {
		app = createMockApp();
		plugin = createMockPlugin(app);
		(app as any).vault.create = jest.fn(async () => {});
	});

	function openModal(
		candidates: string[] = [],
		onPick?: (p: string | null) => void
	) {
		const modal = new EditTargetModal(
			app,
			plugin,
			candidates,
			onPick ?? (() => {})
		);
		modal.onOpen();
		return modal as any;
	}

	test("renders initial file list from vault and allows picking", () => {
		const teamRoot = plugin.settings.teamDocsPath;
		const { root } = buildVaultTree(teamRoot);
		(app as any).vault.getAbstractFileByPath = jest.fn((p: string) =>
			p === teamRoot ? root : null
		);

		const picked = jest.fn();
		const modal = openModal([], picked);

		const list = modal.contentEl.querySelector(".file-list") as HTMLElement;
		const buttons = Array.from(
			list.querySelectorAll("button.file-pick")
		) as HTMLButtonElement[];
		expect(buttons.length).toBeGreaterThanOrEqual(2);

		const firstPath = buttons[0].textContent;
		buttons[0].click();
		expect(picked).toHaveBeenCalledWith(firstPath);
	});

	test("filters files via input", () => {
		const teamRoot = plugin.settings.teamDocsPath;
		const { root } = buildVaultTree(teamRoot);
		(app as any).vault.getAbstractFileByPath = jest.fn((p: string) =>
			p === teamRoot ? root : null
		);

		const modal = openModal();
		const filter = modal.contentEl.querySelector(
			"input[placeholder='Search files…']"
		) as HTMLInputElement;
		filter.value = "note2";
		filter.dispatchEvent(new Event("input"));

		const list = modal.contentEl.querySelector(".file-list") as HTMLElement;
		const buttons = Array.from(
			list.querySelectorAll("button.file-pick")
		) as HTMLButtonElement[];
		expect(buttons.length).toBe(1);
		expect(buttons[0].textContent).toContain("note2.md");
	});

	test("Create validates .md and creates new file under selected directory", async () => {
		const teamRoot = plugin.settings.teamDocsPath;
		const { root, sub } = buildVaultTree(teamRoot);

		const picked = jest.fn();
		const modal = openModal([], picked);

		const dirSelect = modal.contentEl.querySelector("select") as HTMLSelectElement;
		dirSelect.value = teamRoot;

		const nameInput = modal.contentEl.querySelector(
			"input[placeholder='my-note.md']"
		) as HTMLInputElement;
		nameInput.value = "new-file.md";

		const createBtn = Array.from(
			modal.contentEl.querySelectorAll("button")
		).find(
			(b: HTMLButtonElement) => b.textContent === "Create"
		) as HTMLButtonElement;

		await (createBtn as any).onclick();
		await Promise.resolve();

		expect(picked).toHaveBeenCalled();
		const calledWith = picked.mock.calls[0][0] as string;
		expect(calledWith).toMatch(/new-file\.md$/);
		expect(calledWith.startsWith(teamRoot + "/")).toBe(true);
	});

	test("Create without .md does not proceed", async () => {
		const teamRoot = plugin.settings.teamDocsPath;
		const { root } = buildVaultTree(teamRoot);
		(app as any).vault.getAbstractFileByPath = jest.fn((p: string) =>
			p === teamRoot ? root : null
		);

		const picked = jest.fn();
		const modal = openModal([], picked);

		const nameInput = modal.contentEl.querySelector(
			"input[placeholder='my-note.md']"
		) as HTMLInputElement;
		nameInput.value = "missing-ext";

		const createBtn = Array.from(
			modal.contentEl.querySelectorAll("button")
		).find(
			(b: HTMLButtonElement) => b.textContent === "Create"
		) as HTMLButtonElement;

		await (createBtn as any).onclick();

		expect((app as any).vault.create).not.toHaveBeenCalled();
		expect(picked).not.toHaveBeenCalled();
	});

	test("Cancel calls onPick(null)", () => {
		const teamRoot = plugin.settings.teamDocsPath;
		const { root } = buildVaultTree(teamRoot);
		(app as any).vault.getAbstractFileByPath = jest.fn((p: string) =>
			p === teamRoot ? root : null
		);

		const picked = jest.fn();
		const modal = openModal([], picked);

		const cancelBtn = Array.from(
			modal.contentEl.querySelectorAll("button")
		).find(
			(b: HTMLButtonElement) => b.textContent === "Cancel"
		) as HTMLButtonElement;

		cancelBtn.click();
		expect(picked).toHaveBeenCalledWith(null);
	});
});
