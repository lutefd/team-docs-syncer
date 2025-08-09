import { App, TFile } from "obsidian";
import { EditReservationManager } from "../../src/managers/EditReservationManager";
import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";

describe("EditReservationManager", () => {
	let app: App;
	let plugin: any;
	let mgr: EditReservationManager;

	beforeAll(() => {
		(global as any).window = {
			setInterval: setInterval.bind(global),
			clearInterval: clearInterval.bind(global),
		};
	});

	beforeEach(() => {
		app = createMockApp();
		plugin = createMockPlugin(app);
		mgr = new EditReservationManager(app, plugin);
		mgr.onload();
	});

	afterEach(() => {
		mgr.onunload();
		jest.restoreAllMocks();
	});

	test("reserveFile commits and pushes, then getFileReservation returns active", async () => {
		const file = new (TFile as any)("Team/Docs/a.md") as TFile;
		const ok = await mgr.reserveFile(file);
		expect(ok).toBe(true);
		const res = mgr.getFileReservation(file.path);
		expect(res).not.toBeNull();
		expect(plugin.gitService.gitCommand).toHaveBeenCalledWith(
			expect.any(String),
			expect.stringContaining(
				'commit --allow-empty -m "[RESERVE] Team/Docs/a.md'
			)
		);
		expect(plugin.gitService.gitCommand).toHaveBeenCalledWith(
			expect.any(String),
			"push origin main"
		);
	});

	test("extendReservation only when near expiry, emits EXTEND commit", async () => {
		const file = new (TFile as any)("Team/Docs/b.md") as TFile;
		await mgr.reserveFile(file);
		const initial = mgr.getFileReservation(file.path)!;

		const fakeNow = initial.expiresAt - 4 * 60 * 1000;
		const nowSpy = jest.spyOn(Date, "now").mockReturnValue(fakeNow);

		const extended = await mgr.extendReservation(file);
		expect(extended).toBe(true);
		expect(plugin.gitService.gitCommand).toHaveBeenCalledWith(
			expect.any(String),
			expect.stringContaining("[EXTEND] Team/Docs/b.md")
		);

		nowSpy.mockRestore();
	});

	test("releaseFile removes reservation and emits RELEASE commit", async () => {
		const file = new (TFile as any)("Team/Docs/c.md") as TFile;
		await mgr.reserveFile(file);
		await mgr.releaseFile(file);
		expect(mgr.getFileReservation(file.path)).toBeNull();
		expect(plugin.gitService.gitCommand).toHaveBeenCalledWith(
			expect.any(String),
			expect.stringContaining("[RELEASE] Team/Docs/c.md")
		);
	});
});
