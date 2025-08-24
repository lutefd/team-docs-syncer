/** @jest-environment jsdom */
import { createMockApp, createMockPlugin } from "../../helpers/mockPlugin";
import type { App } from "obsidian";

beforeEach(() => {
	(Element.prototype as any).createDiv = function (opts?: any) {
		const el = document.createElement("div");
		if (typeof opts === "string") el.className = opts;
		else if (opts?.cls) el.className = opts.cls;
		this.appendChild(el);
		return el;
	};
	(Element.prototype as any).scrollIntoView = jest.fn();
});

const isWithinAiScopeMock: any = jest.fn((..._args: any[]) => true);
jest.mock("../../../src/utils/PathUtils", () => ({
	PathUtils: {
		isWithinAiScope: (p: string, root: string) => isWithinAiScopeMock(p, root),
	},
}));

import { MentionHandler } from "../../../src/ui/components/MentionHandler";

describe("MentionHandler", () => {
	let app: App;
	let plugin: any;
	let textarea: HTMLTextAreaElement;
	let container: HTMLElement;

	const makeTFile = (path: string) =>
		({
			path,
			basename: path.split("/").pop()!.replace(/\.md$/i, ""),
			extension: "md",
		} as any);

	beforeEach(() => {
		app = createMockApp();
		plugin = createMockPlugin(app);
		container = document.createElement("div");
		textarea = document.createElement("textarea");
		document.body.appendChild(textarea);

		(plugin.app as any).vault.getMarkdownFiles = jest.fn(() => [
			makeTFile("Team/Docs/A.md"),
			makeTFile("Team/Docs/B.md"),
			makeTFile("Other/C.md"),
		]);
		isWithinAiScopeMock.mockImplementation((p: string) =>
			p.startsWith("Team/Docs/")
		);

		(textarea as any).getBoundingClientRect = () => ({
			top: 100,
			left: 50,
			width: 300,
			height: 20,
			bottom: 120,
			right: 350,
			toJSON: () => {},
		});
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	function setValueAndCursor(val: string, cursorIndex: number) {
		textarea.value = val;
		textarea.setSelectionRange(cursorIndex, cursorIndex);
		textarea.dispatchEvent(new Event("input"));
	}

	test("shows menu on valid '@' trigger and filters by query and AI scope", () => {
		const handler = new MentionHandler(plugin, {});
		handler.initialize(textarea, container);

		setValueAndCursor("Hello@A", 7);
		expect(handler.isActive()).toBe(false);

		setValueAndCursor("@a", 2);
		expect(handler.isActive()).toBe(true);
		const menu = document.querySelector(".mention-menu") as HTMLElement;
		expect(menu).not.toBeNull();
		const items = Array.from(
			menu.querySelectorAll(".mention-item")
		) as HTMLElement[];
		expect(items.length).toBe(2);
		const texts = items.map((i) => i.textContent);
		expect(texts).toContain("A.md");
		expect(texts).toContain("B.md");

		setValueAndCursor("@b", 2);
		const items2 = Array.from(
			document.querySelectorAll(".mention-item")
		) as HTMLElement[];
		expect(items2.length).toBe(1);
		expect(items2[0].textContent).toBe("B.md");
	});

	test("hides menu when space after '@' or no '@' present", () => {
		const handler = new MentionHandler(plugin, {});
		handler.initialize(textarea, container);

		setValueAndCursor("No at here", 5);
		expect(handler.isActive()).toBe(false);

		setValueAndCursor("@abc def", 7);
		expect(handler.isActive()).toBe(false);
		expect(document.querySelector(".mention-menu")).toBeNull();
	});

	test("arrow navigation changes selection class, enter inserts wikilink and calls onMentionSelect", () => {
		const onMentionSelect = jest.fn();
		const handler = new MentionHandler(plugin, { onMentionSelect });
		handler.initialize(textarea, container);

		isWithinAiScopeMock.mockReturnValue(true);
		(plugin.app as any).vault.getMarkdownFiles = jest.fn(() => [
			makeTFile("Team/Docs/A.md"),
			makeTFile("Team/Docs/B.md"),
		]);

		setValueAndCursor("@", 1);
		const menu = document.querySelector(".mention-menu") as HTMLElement;
		const items = Array.from(
			menu.querySelectorAll(".mention-item")
		) as HTMLElement[];
		expect(items.length).toBe(2);
		expect(items[0].classList.contains("is-selected")).toBe(true);

		textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
		const itemsAfterDown = Array.from(
			document.querySelectorAll(".mention-item")
		) as HTMLElement[];
		expect(itemsAfterDown[1].classList.contains("is-selected")).toBe(true);

		textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
		expect(handler.isActive()).toBe(false);
		const val = textarea.value;
		const selectedPath = "Team/Docs/B.md";
		expect(val).toBe(`[[${selectedPath}|B.md]]`);
		expect(onMentionSelect).toHaveBeenCalledWith(selectedPath);
	});

	test("escape hides the menu", () => {
		const handler = new MentionHandler(plugin, {});
		handler.initialize(textarea, container);

		setValueAndCursor("@a", 2);
		expect(handler.isActive()).toBe(true);

		textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(handler.isActive()).toBe(false);
		expect(document.querySelector(".mention-menu")).toBeNull();
	});

	test("limits to 10 items", () => {
		const handler = new MentionHandler(plugin, {});
		handler.initialize(textarea, container);

		const many = Array.from({ length: 12 }, (_, i) =>
			makeTFile(`Team/Docs/File${i}.md`)
		);
		(plugin.app as any).vault.getMarkdownFiles = jest.fn(() => many);
		isWithinAiScopeMock.mockReturnValue(true);

		setValueAndCursor("@file", 5);
		const items = Array.from(document.querySelectorAll(".mention-item"));
		expect(items.length).toBe(10);
	});
});
