/** @jest-environment jsdom */
import { App } from "obsidian";
import { ConfirmationModal } from "../../src/ui/modals/ConfirmationModal";
import { createMockApp } from "../helpers/mockPlugin";

describe("ConfirmationModal", () => {
	let app: App;

	beforeEach(() => {
		(Element.prototype as any).createEl = function (tag: string, opts?: any) {
			const el = document.createElement(tag);
			if (opts?.text) el.textContent = opts.text;
			if (opts?.cls) el.className = opts.cls;
			this.appendChild(el);
			return el;
		};
		(Element.prototype as any).createDiv = function (cls?: string) {
			const el = document.createElement("div");
			if (cls) el.className = cls;
			this.appendChild(el);
			return el;
		};
		app = createMockApp();
	});

	test("calls onConfirm(true) when Yes clicked and closes", () => {
		const onConfirm = jest.fn();
		const modal = new ConfirmationModal(app, "Title", "Message", onConfirm);
		modal.open();

		const yesBtn = (modal as any).contentEl.querySelector(
			"button"
		) as HTMLButtonElement;
		expect(yesBtn).not.toBeNull();
		yesBtn.click();

		expect(onConfirm).toHaveBeenCalledWith(true);
	});

	test("calls onConfirm(false) when No clicked and closes", () => {
		const onConfirm = jest.fn();
		const modal = new ConfirmationModal(app, "Title", "Message", onConfirm);
		modal.open();

		const buttons = (modal as any).contentEl.querySelectorAll("button");
		const noBtn = buttons[1] as HTMLButtonElement;
		expect(noBtn).not.toBeNull();
		noBtn.click();

		expect(onConfirm).toHaveBeenCalledWith(false);
	});
});
