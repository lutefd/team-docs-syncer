/** @jest-environment jsdom */
import { App } from "obsidian";
import { StatusIndicator } from "../../src/ui/StatusIndicator";
import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";

describe("StatusIndicator", () => {
	let app: App;
	let plugin: any;
	let status: StatusIndicator;

	beforeEach(() => {
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
});
