import { App } from "obsidian";
import { CommandManager } from "../../src/managers/CommandManager";
import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";

describe("CommandManager", () => {
	let app: App;
	let plugin: any;
	let manager: CommandManager;

	beforeEach(() => {
		app = createMockApp();
		plugin = createMockPlugin(app);
		manager = new CommandManager(app, plugin);
	});

	test("registerCommands adds ribbon icons and commands", () => {
		manager.registerCommands();

		expect(plugin.addRibbonIcon).toHaveBeenCalledWith(
			"sync",
			"Sync Team Docs",
			expect.any(Function)
		);

		expect(plugin.addRibbonIcon).toHaveBeenCalledWith(
			"users",
			"Open Team Activity Feed",
			expect.any(Function)
		);

		expect(plugin.addCommand).toHaveBeenCalledWith(
			expect.objectContaining({ id: "sync-team-docs", name: "Sync Team Docs" })
		);

		expect(plugin.addCommand).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "force-pull-team-docs",
				name: "Force Pull Team Docs",
			})
		);

		expect(plugin.addCommand).toHaveBeenCalledWith(
			expect.objectContaining({ id: "open-team-activity-feed" })
		);
	});

	test("reserve-file and release-file checkCallbacks respect active file and user", async () => {
		const tFile: any = { path: "Team/Docs/note.md" };
		(app as any).workspace.getActiveFile = jest.fn(() => tFile);

		manager.registerCommands();

		const reserveCmd = (plugin.addCommand as jest.Mock).mock.calls.find(
			([arg]: any[]) => arg.id === "reserve-file"
		)[0];

		const releaseCmd = (plugin.addCommand as jest.Mock).mock.calls.find(
			([arg]: any[]) => arg.id === "release-file"
		)[0];

		expect(reserveCmd.checkCallback(false)).toBe(true);
		expect(plugin.reservationManager.reserveFile).toHaveBeenCalledWith(tFile);

		(plugin.reservationManager.getFileReservation as jest.Mock).mockReturnValue(
			null
		);
		expect(releaseCmd.checkCallback(true)).toBe(false);
		(plugin.reservationManager.getFileReservation as jest.Mock).mockReturnValue(
			{ userName: plugin.settings.userName }
		);
		expect(releaseCmd.checkCallback(true)).toBe(true);
		expect(releaseCmd.checkCallback(false)).toBe(true);
		expect(plugin.reservationManager.releaseFile).toHaveBeenCalledWith(tFile);
	});
});
