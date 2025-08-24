/** @jest-environment jsdom */
import { App } from "obsidian";
import { StatusIndicator } from "../../../src/ui/components/StatusIndicator";
import { createMockApp, createMockPlugin } from "../../helpers/mockPlugin";

describe("StatusIndicator", () => {
	let app: App;
	let plugin: any;
	let status: StatusIndicator;

	beforeEach(() => {
		jest.useFakeTimers();
		(Element.prototype as any).empty = function () {
			this.innerHTML = "";
		};
		(Element.prototype as any).addClass = function (cls: string) {
			this.classList.add(cls);
		};
		(Element.prototype as any).createSpan = function (opts?: any) {
			const el = document.createElement("span");
			if (opts?.cls) el.className = opts.cls;
			if (opts?.text) el.textContent = opts.text;
			this.appendChild(el);
			return el;
		};
		(Element.prototype as any).createDiv = function (cls?: any) {
			const el = document.createElement("div");
			if (typeof cls === "string") el.className = cls;
			else if (cls?.cls) el.className = cls.cls;
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
		app = createMockApp();
		plugin = createMockPlugin(app);
		(global as any).window = {
			setInterval: setInterval.bind(global),
			innerHeight: 800,
			innerWidth: 1200,
		};
		status = new StatusIndicator(app, plugin);
		status.onload();
	});

	afterEach(() => {
		status.onunload();
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
	});

	test("setSyncing and setSynced update status bar item", () => {
		status.setSyncing();
		status.setSynced();

		const item = plugin.addStatusBarItem.mock.results[0].value;
		expect(item.setAttribute).toHaveBeenCalledWith(
			"aria-label",
			expect.any(String)
		);
		expect(item.title).toBeDefined();
	});

	test("updateStatus triggers display update", () => {
		status.updateStatus({
			status: "error",
			message: "Boom",
			timestamp: Date.now(),
		});
		const item = plugin.addStatusBarItem.mock.results[0].value;
		expect(item.setAttribute).toHaveBeenCalledWith("aria-label", "Boom");
	});

	test("showStatusDetails toggles tooltip and buttons trigger actions", async () => {
		(status as any).showStatusDetails();
		const tooltip = document.querySelector(
			".team-docs-status-tooltip"
		) as HTMLElement;
		expect(tooltip).not.toBeNull();
		expect(tooltip.querySelector(".status-header h4")?.textContent).toMatch(
			/Team Docs Status/
		);

		const [syncBtn, activityBtn] = Array.from(
			tooltip.querySelectorAll("button")
		) as HTMLButtonElement[];
		syncBtn.click();
		expect(plugin.gitService.syncTeamDocs).toHaveBeenCalled();

		(status as any).showStatusDetails();
		const tooltip2 = document.querySelector(
			".team-docs-status-tooltip"
		) as HTMLElement;
		const actBtn = Array.from(
			tooltip2.querySelectorAll("button")
		)[1] as HTMLButtonElement;
		actBtn.click();
		expect(plugin.uiManager.openActivityFeed).toHaveBeenCalled();
	});

	test("checkStatus sets synced when no changes and remote reachable", async () => {
		(plugin.gitService.gitCommand as jest.Mock).mockImplementation(
			(_cwd: string, cmd: string) => {
				if (cmd.includes("status --porcelain"))
					return Promise.resolve({ stdout: "", stderr: "" });
				if (cmd.includes("fetch origin"))
					return Promise.resolve({ stdout: "", stderr: "" });
				if (cmd.includes("rev-list"))
					return Promise.resolve({ stdout: "0", stderr: "" });
				return Promise.resolve({ stdout: "", stderr: "" });
			}
		);

		await (status as any).checkStatus();
		const item = plugin.addStatusBarItem.mock.results[0].value;
		expect(item.title).toBe("Up to date");
	});

	test("checkStatus detects reservation conflict from changed files", async () => {
		(plugin.gitService.gitCommand as jest.Mock).mockImplementation(
			(_cwd: string, cmd: string) => {
				if (cmd.includes("status --porcelain"))
					return Promise.resolve({ stdout: " M docs/a.md\n", stderr: "" });
				return Promise.resolve({ stdout: "", stderr: "" });
			}
		);

		(plugin.reservationManager.getFileReservation as jest.Mock).mockReturnValue(
			{ userName: "other" }
		);

		await (status as any).checkStatus();
		const item = plugin.addStatusBarItem.mock.results[0].value;
		expect(item.title).toBe("Local changes conflict with remote reservations");
	});
});
