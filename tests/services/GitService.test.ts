import { App, FileSystemAdapter } from "obsidian";
import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import { GitService } from "../../src/services/GitService";

jest.mock("child_process", () => ({
	exec: (cmd: string, opts: any, cb: any) =>
		cb(null, { stdout: "ok", stderr: "" }),
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
});
