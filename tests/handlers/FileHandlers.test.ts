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

	test("autoCommitFile does nothing for files outside team docs", async () => {
		const file = new (TFile as any)("Outside/note.md") as TFile;
		await (handler as any).autoCommitFile(file);
		expect(plugin.gitService.gitCommand).not.toHaveBeenCalled();
	});

	test("onFileModified unreserved online attempts reserve, retries after sync, then succeeds", async () => {
		const file = new (TFile as any)("Team/Docs/retry.md") as TFile;
		(plugin.gitService.isRemoteReachable as jest.Mock).mockResolvedValue(true);
		(plugin.reservationManager.getFileReservation as jest.Mock)
			.mockReturnValueOnce(null)
			.mockReturnValueOnce(null)
			.mockReturnValueOnce({
				userName: plugin.settings.userName,
				expiresAt: Date.now() + 10 * 60 * 1000,
			});
		(plugin.reservationManager.reserveFile as jest.Mock)
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);

		await (handler as any)["onFileModified"](file);

		expect(
			plugin.reservationManager.syncReservationsFromGit
		).toHaveBeenCalled();
		expect(plugin.reservationManager.reserveFile).toHaveBeenCalledTimes(2);
		expect(plugin.gitService.restoreFileFromGit).not.toHaveBeenCalled();
	});

	test("onFileModified with own reservation near expiry triggers extend", async () => {
		const file = new (TFile as any)("Team/Docs/near.md") as TFile;
		(plugin.gitService.isRemoteReachable as jest.Mock).mockResolvedValue(true);
		const exp = Date.now() + 2 * 60 * 1000;
		(plugin.reservationManager.getFileReservation as jest.Mock).mockReturnValue(
			{
				userName: plugin.settings.userName,
				expiresAt: exp,
			}
		);
		await (handler as any)["onFileModified"](file);
		expect(plugin.reservationManager.extendReservation).toHaveBeenCalledWith(
			file
		);
	});

	test("onFileCreated ignores non-image files", async () => {
		const active = new (TFile as any)("Team/Docs/page.md") as TFile;
		(app as any).workspace.getActiveFile = jest.fn(() => active);
		const txt = new (TFile as any)("tmp.txt") as TFile;
		(txt as any).name = "tmp.txt";
		await (app as any).vault.emit("create", txt);
		expect((app as any).vault.createFolder).not.toHaveBeenCalled();
		expect((app as any).fileManager.renameFile).not.toHaveBeenCalled();
	});

	test("onFileCreated no-op when already in attachments subdir", async () => {
		const active = new (TFile as any)("Team/Docs/page.md") as TFile;
		(app as any).workspace.getActiveFile = jest.fn(() => active);
		const img = new (TFile as any)("Team/Docs/assets/exist.png") as TFile;
		(img as any).name = "exist.png";
		await (app as any).vault.emit("create", img);
		expect((app as any).fileManager.renameFile).not.toHaveBeenCalled();
	});

	test("onFileCreated ensures unique filename on clash", async () => {
		const active = new (TFile as any)("Team/Docs/page.md") as TFile;
		(app as any).workspace.getActiveFile = jest.fn(() => active);
		(app as any).vault.getAbstractFileByPath = jest
			.fn()
			.mockReturnValueOnce(null);
		const img = new (TFile as any)("tmp.png") as TFile;
		(img as any).name = "tmp.png";
		(app as any).vault.getAbstractFileByPath
			.mockReturnValueOnce(true)
			.mockReturnValueOnce(null);

		await (app as any).vault.emit("create", img);
		expect((app as any).vault.createFolder).toHaveBeenCalledWith(
			"Team/Docs/assets"
		);
		expect((app as any).fileManager.renameFile).toHaveBeenCalledWith(
			img,
			"Team/Docs/assets/tmp_1.png"
		);
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
		(plugin.gitService.isRemoteReachable as jest.Mock).mockResolvedValue(true);

		await (handler as any)["onFileModified"](file);

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

	test("onEditorChange warns and enforces read view when reserved by other (online)", async () => {
		const tFile = new (TFile as any)("Team/Docs/locked.md") as TFile;
		(app as any).workspace.getActiveFile = jest.fn(() => tFile);
		(plugin.reservationManager.getFileReservation as jest.Mock).mockReturnValue(
			{ userName: "other" }
		);
		(plugin.gitService.isRemoteReachable as jest.Mock).mockResolvedValue(true);

		(app as any).workspace.emit(
			"editor-change",
			{} as any,
			{ file: tFile } as any
		);
		await Promise.resolve();
		expect(plugin.uiManager.enforceReadView).toHaveBeenCalledWith(tFile);
	});

	test("onEditorChange does not enforce read view when offline", async () => {
		const tFile = new (TFile as any)("Team/Docs/locked.md") as TFile;
		(app as any).workspace.getActiveFile = jest.fn(() => tFile);
		(plugin.reservationManager.getFileReservation as jest.Mock).mockReturnValue(
			{ userName: "other" }
		);
		(plugin.gitService.isRemoteReachable as jest.Mock).mockResolvedValue(false);

		(app as any).workspace.emit(
			"editor-change",
			{} as any,
			{ file: tFile } as any
		);
		await Promise.resolve();
		expect(plugin.uiManager.enforceReadView).not.toHaveBeenCalled();
	});

	test("onFileModified offline does not revert or attempt reservation", async () => {
		const file = new (TFile as any)("Team/Docs/offline.md") as TFile;
		(plugin.gitService.isRemoteReachable as jest.Mock).mockResolvedValue(false);
		(plugin.reservationManager.getFileReservation as jest.Mock).mockReturnValue(
			null
		);

		(app as any).vault.emit("modify", file);
		await Promise.resolve();
		jest.runOnlyPendingTimers();

		expect(
			plugin.reservationManager.syncReservationsFromGit
		).not.toHaveBeenCalled();
		expect(plugin.reservationManager.reserveFile).not.toHaveBeenCalled();
		expect(plugin.gitService.restoreFileFromGit).not.toHaveBeenCalled();
	});
});
