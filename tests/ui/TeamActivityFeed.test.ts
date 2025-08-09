/** @jest-environment jsdom */
import { App, WorkspaceLeaf } from "obsidian";
import {
	TeamActivityFeedView,
	ACTIVITY_FEED_VIEW,
} from "../../src/ui/TeamActivityFeed";
import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";

describe("TeamActivityFeedView", () => {
	let app: App;
	let plugin: any;

	beforeEach(() => {
		app = createMockApp();
		plugin = createMockPlugin(app);
		(Element.prototype as any).empty = function () {
			this.innerHTML = "";
		};
		(Element.prototype as any).addClass = function (cls: string) {
			this.classList.add(cls);
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
			if (opts?.cls) el.className = opts.cls;
			this.appendChild(el);
			return el;
		};
		(plugin.gitService.getTeamDocsPath as jest.Mock).mockResolvedValue(
			"/abs/teamdocs"
		);
		(plugin.gitService.gitCommand as jest.Mock).mockResolvedValue({
			stdout: [
				"abcd123|Alice|[RESERVE] Team/Docs/a.md - Alice - 2024-01-01T00:00:00.000Z|2024-01-01T00:00:00.000Z",
				"efef456|Bob|[RELEASE] Team/Docs/a.md - Bob - 2024-01-01T01:00:00.000Z|2024-01-01T01:00:00.000Z",
				"1122aa|Alice|Auto-save: note.md by Alice|2024-01-01T02:00:00.000Z",
			].join("\n"),
			stderr: "",
		});
	});

	test("getViewType returns ACTIVITY_FEED_VIEW and render after open", async () => {
		const leaf = new WorkspaceLeaf();
		const view = new TeamActivityFeedView(leaf as any, plugin);

		expect(view.getViewType()).toBe(ACTIVITY_FEED_VIEW);

		const host = document.createElement("div");
		const content = document.createElement("div");
		(view as any).containerEl = {
			children: [host, content],
			querySelector: document.querySelector.bind(document),
		};

		await view.onOpen();

		expect(plugin.gitService.gitCommand as jest.Mock).toHaveBeenCalled();
		expect(content.querySelector(".activity-list")).not.toBeNull();
	});
});
