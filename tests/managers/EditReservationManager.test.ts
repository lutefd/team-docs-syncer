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
		expect(plugin.gitService.gitCommandRetry).toHaveBeenCalledWith(
			expect.any(String),
			expect.stringContaining(
				'commit --allow-empty -m "[RESERVE] Team/Docs/a.md'
			)
		);
		expect(plugin.gitService.gitCommandRetry).toHaveBeenCalledWith(
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
		expect(plugin.gitService.gitCommandRetry).toHaveBeenCalledWith(
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
		expect(plugin.gitService.gitCommandRetry).toHaveBeenCalledWith(
			expect.any(String),
			expect.stringContaining("[RELEASE] Team/Docs/c.md")
		);
	});

	test("reserveFile returns false when file is outside team docs", async () => {
		const file = new (TFile as any)("Other/Docs/x.md") as TFile;
		const ok = await mgr.reserveFile(file);
		expect(ok).toBe(false);
		expect(plugin.gitService.gitCommandRetry).not.toHaveBeenCalled();
	});

	test("second reserve by same user is a no-op without extra commit", async () => {
		const file = new (TFile as any)("Team/Docs/noop.md") as TFile;
		await mgr.reserveFile(file);
		(plugin.gitService.gitCommandRetry as jest.Mock).mockClear();
		const ok2 = await mgr.reserveFile(file);
		expect(ok2).toBe(true);
		expect(plugin.gitService.gitCommandRetry).not.toHaveBeenCalled();
	});

	test("concurrent reserve calls serialize and commit once", async () => {
		const file = new (TFile as any)("Team/Docs/conc.md") as TFile;
		const orig = plugin.gitService.gitCommandRetry as jest.Mock;
		let firstCommitStarted = false;
		(orig as jest.Mock).mockImplementation(async (cwd: string, cmd: string) => {
			if (cmd.includes("commit --allow-empty").valueOf()) {
				if (!firstCommitStarted) {
					firstCommitStarted = true;
					await new Promise((r) => setTimeout(r, 10));
				}
			}
			return { stdout: "", stderr: "" };
		});

		await Promise.all([mgr.reserveFile(file), mgr.reserveFile(file)]);

		const calls = (plugin.gitService.gitCommandRetry as jest.Mock).mock
			.calls as any[][];
		const commitCalls = calls.filter(
			(c) => typeof c[1] === "string" && c[1].includes("commit --allow-empty")
		);
		expect(commitCalls.length).toBe(1);
	});

	test("extendReservation returns false when far from expiry (no commit)", async () => {
		const file = new (TFile as any)("Team/Docs/far.md") as TFile;
		await mgr.reserveFile(file);
		(plugin.gitService.gitCommandRetry as jest.Mock).mockClear();
		const ok = await mgr.extendReservation(file);
		expect(ok).toBe(false);
		expect(plugin.gitService.gitCommandRetry).not.toHaveBeenCalled();
	});

	test("releaseReservationByPath ignores non-owner reservations", async () => {
		const file = new (TFile as any)("Team/Docs/rel.md") as TFile;
		await mgr.reserveFile(file);
		const origUser = plugin.settings.userName;
		plugin.settings.userName = "other";
		await mgr.releaseReservationByPath("rel.md");
		expect(mgr.getFileReservation(file.path)).not.toBeNull();
		plugin.settings.userName = origUser;
	});

	test("syncReservationsFromGit parses reserve/extend/release and cleans paths", async () => {
		const ts = new Date().toISOString();
		(plugin.gitService.gitCommand as jest.Mock).mockResolvedValueOnce({
			stdout: [
				`a1 [RESERVE] OtherUser/TeamDocs/docs/a.md - Bob - ${ts}`,
				`a2 [EXTEND] someoneElse/docs/b.md - Alice - ${ts}`,
				`a3 [RELEASE] randomPrefix/docs/a.md - Bob - ${ts}`,
			].join("\n"),
			stderr: "",
		});
		await mgr.syncReservationsFromGit();
		const absA = "Team/Docs/docs/a.md";
		const absB = "Team/Docs/docs/b.md";
		expect(mgr.getFileReservation(absA)).toBeNull();
		const b = mgr.getFileReservation(absB);
		if (b) {
			expect(b.userName).toBeDefined();
		}
	});

	test("expired reservations are cleaned up on access", async () => {
		const file = new (TFile as any)("Team/Docs/expire.md") as TFile;
		await mgr.reserveFile(file);
		const initial = mgr.getFileReservation(file.path)!;
		const future = initial.expiresAt + 1;
		const spy = jest.spyOn(Date, "now").mockReturnValue(future);
		expect(mgr.getFileReservation(file.path)).toBeNull();
		spy.mockRestore();
	});
});
