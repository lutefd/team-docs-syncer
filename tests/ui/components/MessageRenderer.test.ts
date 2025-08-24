/** @jest-environment jsdom */
import { createMockApp, createMockPlugin } from "../../helpers/mockPlugin";
import type { App } from "obsidian";

beforeEach(() => {
	(Element.prototype as any).empty = function () {
		this.innerHTML = "";
	};
	(Element.prototype as any).addClass = function (cls: string) {
		this.classList.add(cls);
	};
	(Element.prototype as any).removeClass = function (cls: string) {
		this.classList.remove(cls);
	};
	(Element.prototype as any).hasClass = function (cls: string) {
		return this.classList.contains(cls);
	};
	(Element.prototype as any).createDiv = function (opts?: any) {
		const el = document.createElement("div");
		if (typeof opts === "string") el.className = opts;
		else if (opts?.cls) el.className = opts.cls;
		this.appendChild(el);
		return el;
	};
	(Element.prototype as any).createEl = function (tag: string, opts?: any) {
		const el = document.createElement(tag);
		if (opts?.text) el.textContent = opts.text;
		if (opts?.cls) el.className = opts.cls;
		if (opts?.attr) {
			for (const [k, v] of Object.entries(opts.attr))
				(el as any).setAttribute(k, String(v));
		}
		this.appendChild(el);
		return el;
	};
	(Element.prototype as any).createSpan = function (opts?: any) {
		const el = document.createElement("span");
		if (typeof opts === "string") el.className = opts;
		else if (opts?.cls) el.className = opts.cls;
		if (opts?.text) el.textContent = opts.text;
		this.appendChild(el);
		return el;
	};
});

jest.mock("obsidian", () => {
	const original = jest.requireActual("obsidian");
	return {
		...original,
		MarkdownRenderer: {
			render: jest.fn(async (_app: any, md: string, el: HTMLElement) => {
				const p = document.createElement("p");
				p.textContent = md;
				el.appendChild(p);
			}),
		},
	};
});

const linkFixMock = jest.fn();
jest.mock("../../../src/ui/components/LinkHandler", () => ({
	LinkHandler: function (_plugin: any, _opts: any) {
		this.fixInternalLinks = linkFixMock;
	},
}));

import { MessageRenderer } from "../../../src/ui/components/MessageRenderer";
const { MarkdownRenderer } = require("obsidian");
const renderMock: jest.Mock = MarkdownRenderer.render;

describe("MessageRenderer", () => {
	let app: App;
	let plugin: any;
	let container: HTMLElement;

	beforeEach(() => {
		jest.useFakeTimers();
		renderMock.mockClear();
		linkFixMock.mockClear();
		app = createMockApp();
		plugin = createMockPlugin(app);
		container = document.createElement("div");
	});

	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
	});

	test("renderMessage uses MarkdownRenderer, strips attachedcontent, and fixes links", async () => {
		const mr = new MessageRenderer(plugin, { onFixInternalLinks: jest.fn() });
		const content =
			'Hello [[A.md]]<attachedcontent file="A">secret</attachedcontent> end';

		await mr.renderMessage(container, { role: "assistant", content } as any);

		expect(renderMock).toHaveBeenCalled();
		const callMd = renderMock.mock.calls[0][1];
		expect(callMd).not.toContain("attachedcontent");

		expect(linkFixMock).toHaveBeenCalled();
	});

	test("renderMessage falls back to text when MarkdownRenderer throws", async () => {
		renderMock.mockRejectedValueOnce(new Error("boom"));
		const mr = new MessageRenderer(plugin, {});
		const content = "Hi <attachedcontent>ignore</attachedcontent> there";

		const row = await mr.renderMessage(container, {
			role: "assistant",
			content,
		} as any);
		const text = row.querySelector(".msg-content")!.textContent!;
		expect(text).toContain("Hi ");
		expect(text).not.toContain("attachedcontent");
		expect(linkFixMock).toHaveBeenCalled();
	});

	test("renderMessages clears and renders all then scrolls to bottom", async () => {
		const mr = new MessageRenderer(plugin, {});
		container.innerHTML = "X";

		await mr.renderMessages(container, [
			{ role: "user", content: "A" } as any,
			{ role: "assistant", content: "B" } as any,
		]);

		expect(container.querySelectorAll(".msg").length).toBe(2);
		expect(container.scrollTop).toBe(container.scrollHeight);
	});

	test("createStreamingMessage update/append/placeholder/thinking/finalize", async () => {
		const mr = new MessageRenderer(plugin, { onFixInternalLinks: jest.fn() });
		const stream = mr.createStreamingMessage(container, "assistant");

		stream.setPlaceholder("Loading...");
		expect(stream.contentEl.classList.contains("placeholder")).toBe(true);

		const delta = "<think>plan</think><finalAnswer>Hello</finalAnswer>";
		stream.appendContent(delta);
		await Promise.resolve();
		jest.advanceTimersByTime(30);

		expect(renderMock).toHaveBeenCalled();
		const lastMd = renderMock.mock.calls[renderMock.mock.calls.length - 1][1];
		expect(lastMd).toBe("Hello");

		const thinking = container.querySelector(
			".thinking-section"
		) as HTMLElement;
		expect(thinking).not.toBeNull();
		const header = thinking.querySelector(".thinking-header") as HTMLElement;
		const contentEl = thinking.querySelector(
			".thinking-content"
		) as HTMLElement;
		expect(contentEl.textContent).toContain("plan");
		header.click();
		expect(contentEl.classList.contains("collapsed")).toBe(true);

		stream.setThinking(true);
		expect(stream.contentEl.classList.contains("thinking")).toBe(true);
		stream.setThinking(false);
		expect(stream.contentEl.classList.contains("thinking")).toBe(false);

		renderMock.mockClear();
		renderMock.mockClear();
		stream.updateContent(
			"<think>ignore</think><finalAnswer>Answer</finalAnswer>"
		);
		jest.advanceTimersByTime(30);
		expect(renderMock).toHaveBeenCalled();
		const md2 = renderMock.mock.calls[0][1];
		expect(md2).toBe("Answer");

		renderMock.mockClear();
		await stream.finalize();
		expect(renderMock).toHaveBeenCalled();
		expect(linkFixMock).toHaveBeenCalled();
	});
});
