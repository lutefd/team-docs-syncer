/** @jest-environment jsdom */
import { App } from "obsidian";
import { createMockApp } from "../../helpers/mockPlugin";
import { DiffModal } from "../../../src/ui/modals/DiffModal";

describe("DiffModal", () => {
	let app: App;
	const filePath = "docs/file.md";
	const original = "# Title\nOriginal content";
	const proposed = "# Title\nProposed content";

	beforeEach(() => {
		app = createMockApp();

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
			if (opts?.attr) {
				for (const [k, v] of Object.entries(opts.attr))
					(el as any).setAttribute(k, String(v));
			}
			this.appendChild(el);
			return el;
		};
	});

	async function openModal(
		onClose?: (confirmed: boolean, edited?: string) => void
	) {
		const modal = new DiffModal(app, filePath, original, proposed, onClose);
		await modal.onOpen();
		await Promise.resolve();
		return modal as any;
	}

	test("renders header, columns, and initial rendered view", async () => {
		const modal = await openModal();

		const header = modal.contentEl.querySelector(
			".diff-modal-header"
		) as HTMLElement;
		expect(header).toBeTruthy();
		expect(header.querySelector("h3")?.textContent).toContain(filePath);

		const cols = Array.from(
			modal.contentEl.querySelectorAll(".diff-columns .diff-col")
		) as HTMLElement[];
		expect(cols.length).toBe(2);

		const leftRendered = modal.contentEl.querySelector(
			".diff-content-container .diff-rendered"
		) as HTMLElement;
		const leftRaw = modal.contentEl.querySelector(".diff-pre") as HTMLElement;
		const rightRendered = modal.contentEl.querySelectorAll(
			".diff-content-container .diff-rendered"
		)[1] as HTMLElement;
		const rightTextarea = modal.contentEl.querySelector(
			".diff-textarea"
		) as HTMLTextAreaElement;

		expect(getComputedStyle(leftRendered).display).toBe("block");
		expect(getComputedStyle(rightRendered).display).toBe("block");
		expect(getComputedStyle(leftRaw).display).toBe("none");
		expect(getComputedStyle(rightTextarea).display).toBe("none");

		expect(leftRendered.textContent).toContain("Original content");
		expect(rightRendered.textContent).toContain("Proposed content");
	});

	test("toggle to Raw and back to Rendered, preserving edits", async () => {
		const modal = await openModal();

		const [renderedBtn, rawBtn] = Array.from(
			modal.contentEl.querySelectorAll(".diff-toggle-btn")
		) as HTMLButtonElement[];

		await (rawBtn as any).onclick();
		const leftRaw = modal.contentEl.querySelector(".diff-pre") as HTMLElement;
		const rightTextarea = modal.contentEl.querySelector(
			".diff-textarea"
		) as HTMLTextAreaElement;

		expect(getComputedStyle(leftRaw).display).toBe("block");
		expect(getComputedStyle(rightTextarea).display).toBe("block");

		rightTextarea.value = "# Title\nEdited content";
		rightTextarea.dispatchEvent(new Event("input"));

		await (renderedBtn as any).onclick();
		const rightRendered = modal.contentEl.querySelectorAll(
			".diff-content-container .diff-rendered"
		)[1] as HTMLElement;

		expect(getComputedStyle(rightRendered).display).toBe("block");
		expect(rightRendered.textContent).toContain("Edited content");
	});

	test("Apply calls callback with edited content and closes", async () => {
		const onClose = jest.fn();
		const modal = await openModal(onClose);

		const [, rawBtn] = Array.from(
			modal.contentEl.querySelectorAll(".diff-toggle-btn")
		) as HTMLButtonElement[];
		rawBtn.click();
		const textarea = modal.contentEl.querySelector(
			".diff-textarea"
		) as HTMLTextAreaElement;
		textarea.value = "# Title\nAccepted edit";
		textarea.dispatchEvent(new Event("input"));

		const applyBtn = Array.from(
			modal.contentEl.querySelectorAll("button")
		).find(
			(b: HTMLButtonElement) => b.textContent === "Apply"
		) as HTMLButtonElement;
		expect(applyBtn).toBeTruthy();
		applyBtn.click();

		expect(onClose).toHaveBeenCalledWith(true, "# Title\nAccepted edit");
	});

	test("Cancel calls callback with false", async () => {
		const onClose = jest.fn();
		const modal = await openModal(onClose);

		const cancelBtn = Array.from(
			modal.contentEl.querySelectorAll("button")
		).find(
			(b: HTMLButtonElement) => b.textContent === "Cancel"
		) as HTMLButtonElement;

		expect(cancelBtn).toBeTruthy();
		cancelBtn.click();

		expect(onClose).toHaveBeenCalledWith(false);
	});
});
