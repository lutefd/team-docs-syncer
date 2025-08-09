import { App, FileSystemAdapter } from "obsidian";
import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import { GitService } from "../../src/services/GitService";

jest.mock("child_process", () => ({
    exec: jest.fn((cmd: string, opts: any, cb: any) =>
        cb(null, { stdout: "ok", stderr: "" })
    ),
}));

describe("GitService", () => {
	let app: App;
	let plugin: any;
	let svc: GitService;

	beforeEach(() => {
		app = createMockApp();
		plugin = createMockPlugin(app);
		svc = new GitService(app, plugin);
	});

	test("getTeamDocsPath returns null when not desktop adapter", async () => {
		(app as any).vault.adapter = {} as any;
		const p = await svc.getTeamDocsPath();
		expect(p).toBeNull();
	});

	test("getTeamDocsPath returns path from FileSystemAdapter", async () => {
		(app as any).vault.adapter = new (FileSystemAdapter as any)();
		(app as any).vault.adapter.getFullPath = jest.fn(() => "/abs/teamdocs");
		const p = await svc.getTeamDocsPath();
		expect(p).toBe("/abs/teamdocs");
	});

	test("gitCommand prefixes git and passes cwd", async () => {
		const res = await svc.gitCommand("/repo", "status");
		expect(res.stdout).toBe("ok");
	});

	test("restoreFileFromGit checks out path relative to team docs root", async () => {
		plugin.settings.teamDocsPath = "Team/Docs";
		(app as any).vault.adapter = new (FileSystemAdapter as any)();
		(app as any).vault.adapter.getFullPath = jest.fn(() => "/abs/Team/Docs");

		const spy = jest.spyOn(svc as any, "gitCommand");
		await svc.restoreFileFromGit("Team/Docs/note.md");

		expect(spy).toHaveBeenCalledWith(
			"/abs/Team/Docs",
			expect.stringContaining('checkout HEAD -- "note.md"')
		);
	});

	test("isRemoteReachable returns true on successful ls-remote", async () => {
		(app as any).vault.adapter = new (FileSystemAdapter as any)();
		(app as any).vault.adapter.getFullPath = jest.fn(() => "/abs/teamdocs");
		const ok = await svc.isRemoteReachable();
		expect(ok).toBe(true);
	});

	test("isRemoteReachable returns false on exec error", async () => {
		(app as any).vault.adapter = new (FileSystemAdapter as any)();
		(app as any).vault.adapter.getFullPath = jest.fn(() => "/abs/teamdocs");

		const child = require("child_process");
		const original = child.exec;
		(child.exec as jest.Mock).mockImplementationOnce(
			(cmd: string, opts: any, cb: any) => {
				cb(new Error("network error"), { stdout: "", stderr: "" });
			}
		);

		const ok = await svc.isRemoteReachable();
		expect(ok).toBe(false);

		child.exec = original;
	});
});
