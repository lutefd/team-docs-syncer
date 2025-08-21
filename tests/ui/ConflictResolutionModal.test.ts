/** @jest-environment jsdom */
import { App } from "obsidian";
import { ConflictResolutionModal } from "../../src/ui/modals/ConflictResolutionModal";
import { createMockApp } from "../helpers/mockPlugin";

describe("ConflictResolutionModal", () => {
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

	test("clicking buttons triggers correct resolutions", () => {
		const onResolve = jest.fn();
		const modal = new ConflictResolutionModal(app, "conflict msg", onResolve);
		modal.open();

		const buttons = (modal as any).contentEl.querySelectorAll("button");
		(buttons[0] as HTMLButtonElement).click();
		(buttons[1] as HTMLButtonElement).click();
		(buttons[2] as HTMLButtonElement).click();

		expect(onResolve).toHaveBeenCalledWith("theirs");
		expect(onResolve).toHaveBeenCalledWith("mine");
		expect(onResolve).toHaveBeenCalledWith("manual");
	});
});
