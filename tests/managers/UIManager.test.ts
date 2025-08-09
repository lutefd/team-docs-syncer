/** @jest-environment jsdom */
import { App, TFile, MarkdownView } from "obsidian";
import { UIManager } from "../../src/managers/UIManager";
import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import { ACTIVITY_FEED_VIEW } from "../../src/ui/TeamActivityFeed";

describe("UIManager", () => {
	let app: App;
	let plugin: any;
	let ui: UIManager;

	beforeEach(() => {
		document.body.innerHTML = "";
		(Element.prototype as any).createDiv = function (cls?: string) {
			const el = document.createElement("div");
			if (cls) el.className = cls;
			this.appendChild(el);
			return el;
		};
		(Element.prototype as any).addClass = function (cls: string) {
			this.classList.add(cls);
		};
		app = createMockApp();
		plugin = createMockPlugin(app);
		ui = new UIManager(app, plugin);
	});

	test("openActivityFeed opens right leaf with ACTIVITY_FEED_VIEW", () => {
		const rightLeaf = { setViewState: jest.fn() };
		(app as any).workspace.getRightLeaf = jest.fn(() => rightLeaf);
		(app as any).workspace.getLeavesOfType = jest.fn(() => []);

		ui.openActivityFeed();

		expect((app as any).workspace.detachLeavesOfType).toHaveBeenCalledWith(
			ACTIVITY_FEED_VIEW
		);
		expect(rightLeaf.setViewState).toHaveBeenCalledWith(
			expect.objectContaining({ type: ACTIVITY_FEED_VIEW, active: true })
		);
		expect((app as any).workspace.revealLeaf).toHaveBeenCalledWith(rightLeaf);
	});

	test("updateFileReservationUI shows indicator for own reservation", async () => {
		const leaf = document.createElement("div");
		leaf.className = "workspace-leaf mod-active";
		const header = document.createElement("div");
		header.className = "view-header";
		leaf.appendChild(header);
		document.body.appendChild(leaf);

		const file = new (TFile as any)("Team/Docs/x.md") as TFile;

		(plugin.reservationManager.getFileReservation as jest.Mock).mockReturnValue(
			{
				userName: plugin.settings.userName,
			}
		);

		ui.updateFileReservationUI(file);

		const indicator = document.querySelector(
			".file-reservation-indicator"
		) as HTMLDivElement;
		expect(indicator).not.toBeNull();
		expect(indicator.textContent).toMatch(/Reserved by you/);

		expect(indicator!.classList.contains("own-reservation")).toBe(true);
	});

	test("enforceReadView switches to preview when not already", () => {
		const file = new (TFile as any)("Team/Docs/y.md") as TFile;
		(app as any).workspace.getActiveFile = jest.fn(() => file);

		const fakeView: Partial<MarkdownView> & any = {
			getMode: jest.fn(() => "source"),
			setMode: jest.fn(),
		};
		(app as any).workspace.getActiveViewOfType = jest.fn(() => fakeView);

		ui.enforceReadView(file);

		expect(fakeView.setMode).toHaveBeenCalledWith("preview");
	});
});
