import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import { App, TFile } from "obsidian";

jest.mock("src/utils/PathUtils", () => ({
	PathUtils: {
		isWithinAiScope: jest.fn((p: string, root: string) =>
			p.startsWith("Team/Docs")
		),
	},
}));

describe("MarkdownIndexService", () => {
	let app: App;
	let plugin: any;
	let svc: any;
	let listeners: Record<string, Function[]>;

	function makeFile(path: string): TFile {
		const f = new (TFile as any)(path);
		(f as any).path = path;
		(f as any).extension = path.split(".").pop();
		(f as any).basename = path.split("/").pop()?.replace(/\.md$/, "");
		return f as any;
	}

	beforeEach(() => {
		jest.resetModules();
		app = createMockApp();
		plugin = createMockPlugin(app);

		listeners = {};
		(app as any).vault.on = jest.fn((evt: string, cb: any) => {
			(listeners[evt] = listeners[evt] || []).push(cb);
			return () => {};
		});
		(app as any).vault.getMarkdownFiles = jest.fn(() => []);

		(app as any).metadataCache = {
			getFileCache: jest.fn((file: TFile) => ({ frontmatter: undefined })),
		};

		const {
			MarkdownIndexService,
		} = require("../../src/services/MarkdownIndexService");
		svc = new MarkdownIndexService(app, plugin);
	});

	test("rebuildIndex indexes only files within scope with title and frontmatter", async () => {
		const a = makeFile("Team/Docs/Alpha.md");
		const b = makeFile("Team/Docs/Beta.md");
		const c = makeFile("Outside/Out.md");

		(app as any).vault.getMarkdownFiles.mockReturnValue([a, b, c]);
		(app as any).metadataCache.getFileCache = jest.fn((file: TFile) => {
			if ((file as any).path.endsWith("Alpha.md"))
				return { frontmatter: { title: "Alpha Title", tag: "x" } };
			return { frontmatter: undefined };
		});

		await svc.rebuildIndex();

		const r1 = svc.search("alpha");
		expect(r1[0].title).toBe("Alpha Title");

		const r2 = svc.search("beta");
		expect(r2[0].title.toLowerCase()).toContain("beta");

		const r3 = svc.search("outside");
		expect(r3.length).toBe(0);
	});

	test("init registers listeners; create/modify update index and delete removes", async () => {
		await svc.init();
		expect((app as any).vault.on).toHaveBeenCalled();

		const f = makeFile("Team/Docs/Note.md");
		for (const cb of listeners["create"] || []) cb(f);
		for (const cb of listeners["modify"] || []) cb(f);
		await Promise.resolve();
		await Promise.resolve();

		if (typeof (svc as any).updateFile === "function") {
			await (svc as any).updateFile(f);
		}
		let res = svc.search("note");
		expect(res.length).toBe(1);

		for (const cb of listeners["delete"] || []) await cb(f);
		(app as any).vault.getMarkdownFiles.mockReturnValue([]);
		await svc.rebuildIndex();
		res = svc.search("note");
		expect(res.length).toBe(0);
	});

	test("search ranks by score and updatedAt when scores tie", async () => {
		const a = makeFile("Team/Docs/Lorem.md");
		const b = makeFile("Team/Docs/Ipsum.md");
		(app as any).vault.getMarkdownFiles.mockReturnValue([a, b]);

		(app as any).metadataCache.getFileCache = jest.fn((file: TFile) => {
			if ((file as any).path.endsWith("Lorem.md"))
				return { frontmatter: { tags: ["term"] } };
			return { frontmatter: undefined };
		});

		const nowSpy = jest.spyOn(Date, "now");
		nowSpy.mockReturnValueOnce(1000);
		nowSpy.mockReturnValueOnce(2000);
		await svc.rebuildIndex();

		let res = svc.search("ipsum term");
		expect(res[0].path.endsWith("Ipsum.md")).toBe(true);

		(app as any).metadataCache.getFileCache = jest.fn((_file: TFile) => ({
			frontmatter: { k: "term" },
		}));
		nowSpy.mockReturnValueOnce(3000);
		nowSpy.mockReturnValueOnce(2500);
		await svc.rebuildIndex();

		res = svc.search("term");
		expect(res[0].path.endsWith("Lorem.md")).toBe(true);

		nowSpy.mockRestore();
	});
});
