import { App, TFile } from "obsidian";
import { FileHandler } from "../../src/handlers/FileHandlers";
import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";

jest.useFakeTimers();

describe("FileHandler", () => {
	let app: App;
	let plugin: any;
	let handler: FileHandler;

	beforeEach(() => {
		app = createMockApp();
		plugin = createMockPlugin(app);
		handler = new FileHandler(app, plugin);
		handler.registerEventHandlers();
	});

	test("autoCommitFile adds and commits when own reservation is active", async () => {
		const file = new (TFile as any)("Team/Docs/note.md") as TFile;
		const now = Date.now();
		(plugin.reservationManager.getFileReservation as jest.Mock).mockReturnValue(
			{
				userName: plugin.settings.userName,
				expiresAt: now + 10 * 60 * 1000,
			}
		);

		await (handler as any).autoCommitFile(file);

		const calls = (plugin.gitService.gitCommand as jest.Mock).mock
			.calls as any[][];
		expect(
			calls.some(
				(args) => typeof args[1] === "string" && args[1].startsWith("add ")
			)
		).toBe(true);
		expect(
			calls.some(
				(args) =>
					typeof args[1] === "string" &&
					args[1].includes('commit -m "Auto-save:')
			)
		).toBe(true);
	});

	test("onFileModified with other user's reservation restores file and no commit", async () => {
		const file = new (TFile as any)("Team/Docs/other.md") as TFile;
		(plugin.reservationManager.getFileReservation as jest.Mock).mockReturnValue(
			{ userName: "other" }
		);

		(app as any).vault.emit("modify", file);
		await Promise.resolve();
		jest.runOnlyPendingTimers();

		expect(plugin.gitService.restoreFileFromGit).toHaveBeenCalledWith(
			file.path
		);
		expect(plugin.gitService.gitCommand).not.toHaveBeenCalledWith(
			expect.any(String),
			expect.stringMatching(/^add /)
		);
	});

	test("onFileCreated moves image into attachments subdir and renames uniquely", async () => {
		const active = new (TFile as any)("Team/Docs/page.md") as TFile;
		(app as any).workspace.getActiveFile = jest.fn(() => active);

		(app as any).vault.getAbstractFileByPath = jest
			.fn()
			.mockReturnValueOnce(null)
			.mockReturnValueOnce(null);

		const img = new (TFile as any)("tmp.png") as TFile;
		(img as any).name = "tmp.png";

		await (app as any).vault.emit("create", img);

		expect((app as any).vault.createFolder).toHaveBeenCalledWith(
			"Team/Docs/assets"
		);
		expect((app as any).fileManager.renameFile).toHaveBeenCalledWith(
			img,
			"Team/Docs/assets/tmp.png"
		);
	});

	test("onEditorChange warns and enforces read view when reserved by other", () => {
		const tFile = new (TFile as any)("Team/Docs/locked.md") as TFile;
		(app as any).workspace.getActiveFile = jest.fn(() => tFile);
		(plugin.reservationManager.getFileReservation as jest.Mock).mockReturnValue(
			{ userName: "other" }
		);

		(app as any).workspace.emit(
			"editor-change",
			{} as any,
			{ file: tFile } as any
		);

		expect(plugin.uiManager.enforceReadView).toHaveBeenCalledWith(tFile);
	});
});
