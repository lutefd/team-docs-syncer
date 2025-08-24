/** @jest-environment jsdom */
import { createMockApp, createMockPlugin } from "../../helpers/mockPlugin";
import type { App } from "obsidian";

beforeEach(() => {
	(Element.prototype as any).addClass = function (cls: string) {
		this.classList.add(cls);
	};
	(Element.prototype as any).removeClass = function (cls: string) {
		this.classList.remove(cls);
	};
});

import { LinkHandler } from "../../../src/ui/components/LinkHandler";

describe("LinkHandler", () => {
	let app: App;
	let plugin: any;
	let container: HTMLElement;
	let TFileRef: any;

	const makeTFile = (path: string) => {
		const obj: any = Object.create((TFileRef as any).prototype);
		obj.path = path;
		obj.basename = path.split("/").pop()?.replace(/\.md$/i, "") ?? path;
		obj.extension = path.split(".").pop();
		return obj;
	};

	beforeEach(() => {
		app = createMockApp();
		plugin = createMockPlugin(app);
		container = document.createElement("div");
		TFileRef = require("obsidian").TFile;

		(app as any).workspace.getLeaf = jest.fn(() => ({ openFile: jest.fn() }));
	});

	test("fixStandardLinks adds classes, normalizes text, and clicks open file", () => {
		const handler = new LinkHandler(plugin, {});
		container.innerHTML =
			'<a data-href="Team/Docs/A.md">A</a> <a data-href="x/y/B.md">B.md</a> <a data-href="C.md">Some Name</a>';

		handler.fixInternalLinks(container);

		const links = Array.from(container.querySelectorAll("a[data-href]"));
		expect(links.length).toBe(3);
		for (const a of links) {
			expect(a.classList.contains("internal-link")).toBe(true);
			expect(a.classList.contains("is-unresolved")).toBe(true);
		}
		expect((links[0] as HTMLAnchorElement).textContent).toBe("A.md");
		expect((links[1] as HTMLAnchorElement).textContent).toBe("B.md");
		expect((links[2] as HTMLAnchorElement).textContent).toBe("Some Name");

		const onOpen = jest.fn();
		const handler2 = new LinkHandler(plugin, { onOpenFile: onOpen });
		const container2 = document.createElement("div");
		container2.innerHTML =
			'<a data-href="Team/Docs/A.md">A</a> <a data-href="x/y/B.md">B.md</a> <a data-href="C.md">Some Name</a>';
		handler2.fixInternalLinks(container2);
		(
			container2.querySelectorAll("a[data-href]")[0] as HTMLAnchorElement
		).click();
		expect(onOpen).toHaveBeenCalledWith("Team/Docs/A.md");
	});

	test("fixWikiLinks converts [[path|display]] to clickable anchors in text nodes", () => {
		const handler = new LinkHandler(plugin, {});
		container.textContent =
			"Start [[Team/Docs/A.md|Alpha]] middle [[B.md]] end";

		handler["fixWikiLinks" as any](container);

		const anchors = Array.from(container.querySelectorAll("a.internal-link"));
		expect(anchors.length).toBe(2);
		expect((anchors[0] as HTMLAnchorElement).dataset.href).toBe(
			"Team/Docs/A.md"
		);
		expect((anchors[0] as HTMLAnchorElement).textContent).toBe("Alpha");
		expect((anchors[1] as HTMLAnchorElement).dataset.href).toBe("B.md");
		expect((anchors[1] as HTMLAnchorElement).textContent).toBe("B.md");

		const onOpen = jest.fn();
		const handler2 = new LinkHandler(plugin, { onOpenFile: onOpen });
		const container2 = document.createElement("div");
		container2.textContent =
			"Start [[Team/Docs/A.md|Alpha]] middle [[B.md]] end";
		handler2["fixWikiLinks" as any](container2);
		const anchors2 = Array.from(container2.querySelectorAll("a.internal-link"));
		(anchors2[1] as HTMLAnchorElement).click();
		expect(onOpen).toHaveBeenCalledWith("B.md");
	});

	test("createInternalLink returns anchor with dataset and click opens", () => {
		const onOpen = jest.fn();
		const handler = new LinkHandler(plugin, { onOpenFile: onOpen });
		const a = handler.createInternalLink("x/y/Z.md", "Zed");

		expect(a.classList.contains("internal-link")).toBe(true);
		expect(a.dataset.href).toBe("x/y/Z.md");
		expect(a.textContent).toBe("Zed");

		a.click();
		expect(onOpen).toHaveBeenCalledWith("x/y/Z.md");
	});

	test("extractLinks parses wiki links with optional display", () => {
		const handler = new LinkHandler(plugin, {});
		const out = handler.extractLinks("[[A.md|Alpha]] and [[B.md]]");
		expect(out).toEqual([
			{ path: "A.md", displayName: "Alpha" },
			{ path: "B.md", displayName: undefined },
		]);
	});

	test("openFile uses Obsidian APIs when no onOpenFile; logs warn when not found", () => {
		const handler = new LinkHandler(plugin, {});
		const file = makeTFile("Team/Docs/A.md");

		(plugin.app.vault.getAbstractFileByPath as jest.Mock).mockImplementation(
			(p: string) => (p === file.path ? file : null)
		);
		const leaf = { openFile: jest.fn() };
		(app as any).workspace.getLeaf = jest.fn(() => leaf as any);

		handler["openFile" as any](file.path);
		expect(leaf.openFile).toHaveBeenCalled();

		const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
		handler["openFile" as any]("Missing.md");
		expect(warnSpy).toHaveBeenCalled();
	});
});
