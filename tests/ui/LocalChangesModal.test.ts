/** @jest-environment jsdom */
import { App } from "obsidian";
import { LocalChangesModal } from "../../src/ui/modals/LocalChangesModal";
import { createMockApp } from "../helpers/mockPlugin";

describe("LocalChangesModal", () => {
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

	test("commit button triggers onResolve('commit')", () => {
		const onResolve = jest.fn();
		const modal = new LocalChangesModal(app, onResolve);
		modal.open();

		const btn = (modal as any).contentEl.querySelector(
			"button"
		) as HTMLButtonElement;
		btn.click();
		expect(onResolve).toHaveBeenCalledWith("commit");
	});

	test("stash and discard buttons trigger respective actions", () => {
		const onResolve = jest.fn();
		const modal = new LocalChangesModal(app, onResolve);
		modal.open();

		const buttons = (modal as any).contentEl.querySelectorAll("button");
		(buttons[1] as HTMLButtonElement).click();
		(buttons[2] as HTMLButtonElement).click();

		expect(onResolve).toHaveBeenCalledWith("stash");
		expect(onResolve).toHaveBeenCalledWith("discard");
	});
});
