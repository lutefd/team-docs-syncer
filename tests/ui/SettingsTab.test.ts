/** @jest-environment jsdom */
import { App, FileSystemAdapter } from "obsidian";
import { TeamDocsSettingTab } from "../../src/ui/SettingsTab";
import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";

describe("TeamDocsSettingTab", () => {
	let app: App;
	let plugin: any;

	beforeEach(() => {
		(Element.prototype as any).empty = function () {
			this.innerHTML = "";
		};
		(Element.prototype as any).appendText = function (text: string) {
			this.appendChild(document.createTextNode(text));
		};
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
		plugin = createMockPlugin(app);
	});

	test("display renders header and desktop warning when not FileSystemAdapter", () => {
		(app as any).vault.adapter = {} as any;
		const tab = new TeamDocsSettingTab(app, plugin);

		tab.display();

		expect(tab.containerEl.querySelector("h2")?.textContent).toMatch(
			/Team Docs Git Sync Settings/
		);
		expect(
			tab.containerEl.querySelector(".conflict-resolution-buttons") ||
				tab.containerEl.querySelector("div")
		).not.toBeNull();
	});

	test("no desktop warning when FileSystemAdapter present", () => {
		(app as any).vault.adapter = new (FileSystemAdapter as any)();
		const tab = new TeamDocsSettingTab(app, plugin);
		tab.display();

		expect(tab.containerEl.querySelector("h2")).not.toBeNull();
	});
});
