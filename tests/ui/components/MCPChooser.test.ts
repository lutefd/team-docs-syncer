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
		if (opts?.type) (el as HTMLInputElement).setAttribute("type", opts.type);
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

import { MCPChooser } from "../../../src/ui/components/MCPChooser";

describe("MCPChooser", () => {
	let app: App;
	let plugin: any;
	let container: HTMLElement;

	beforeEach(() => {
		app = createMockApp();
		plugin = createMockPlugin(app);
		container = document.createElement("div");

		plugin.settings.mcpClients = [
			{
				id: "a",
				name: "Alpha",
				enabled: true,
				transport: { type: "stdio" as any },
			},
			{
				id: "b",
				name: "Beta",
				enabled: true,
				transport: { type: "stdio" as any },
			},
			{
				id: "c",
				name: "Gamma",
				enabled: false,
				transport: { type: "stdio" as any },
			},
		];
		plugin.mcpManager.getClient = jest.fn((id: string) => {
			if (id === "a") return { connected: true };
			if (id === "b") return { connected: false, lastError: "boom" };
			return null;
		});
	});

	test("renders checkboxes for enabled clients, applies initialSelection and connection statuses", () => {
		const onSelectionChange = jest.fn();
		const chooser = new MCPChooser(container, {
			plugin,
			onSelectionChange,
			initialSelection: { clientIds: ["a"] },
		});

		expect(container.classList.contains("mcp-chooser")).toBe(true);

		const cbA = container.querySelector("#mcp-a") as HTMLInputElement;
		const cbB = container.querySelector("#mcp-b") as HTMLInputElement;
		expect(cbA).not.toBeNull();
		expect(cbB).not.toBeNull();
		expect(cbA.checked).toBe(true);
		expect(cbB.checked).toBe(false);

		const statuses = Array.from(
			container.querySelectorAll(".mcp-connection-status")
		) as HTMLSpanElement[];
		expect(statuses.length).toBe(2);
		expect(statuses[0].textContent?.includes("✅")).toBe(true);
		expect(statuses[1].textContent?.includes("❌")).toBe(true);
		expect(statuses[1].title).toContain("boom");

		const statusSummary = container.querySelector(
			".mcp-status span"
		) as HTMLSpanElement;
		expect(statusSummary.textContent).toContain("1/2 servers selected");
	});

	test("toggling checkboxes updates selection and status, calls onSelectionChange", () => {
		const onSelectionChange = jest.fn();
		const chooser = new MCPChooser(container, {
			plugin,
			onSelectionChange,
			initialSelection: { clientIds: ["a"] },
		});

		const cbB = container.querySelector("#mcp-b") as HTMLInputElement;
		cbB.checked = true;
		cbB.dispatchEvent(new Event("change"));
		expect(onSelectionChange).toHaveBeenCalled();
		const statusSummary1 = container.querySelector(
			".mcp-status span"
		) as HTMLSpanElement;
		expect(statusSummary1.textContent).toContain("2/2 servers selected");

		cbB.checked = false;
		cbB.dispatchEvent(new Event("change"));
		const statusSummary2 = container.querySelector(
			".mcp-status span"
		) as HTMLSpanElement;
		expect(statusSummary2.textContent).toContain("1/2 servers selected");
	});

	test("setSelection/getSelection/selectAll/selectNone/refresh", () => {
		const onSelectionChange = jest.fn();
		const chooser = new MCPChooser(container, { plugin, onSelectionChange });

		chooser.setSelection({ clientIds: ["b"] });
		expect(chooser.getSelection().clientIds).toEqual(["b"]);
		expect(
			(container.querySelector("#mcp-b") as HTMLInputElement).checked
		).toBe(true);

		chooser.selectAll();
		expect(chooser.getSelection().clientIds.sort()).toEqual(["a", "b"].sort());

		chooser.selectNone();
		expect(chooser.getSelection().clientIds).toEqual([]);

		onSelectionChange.mockClear();
		chooser.setSelection({ clientIds: ["a"] });
		onSelectionChange.mockClear();
		chooser.refresh();
		expect(chooser.getSelection().clientIds).toEqual(["a"]);
		expect(onSelectionChange).toHaveBeenCalledWith({ clientIds: ["a"] });
	});

	test("shows empty state when no enabled clients", () => {
		plugin.settings.mcpClients = [
			{
				id: "x",
				name: "X",
				enabled: false,
				transport: { type: "stdio" as any },
			},
		];
		const onSelectionChange = jest.fn();
		const chooser = new MCPChooser(container, { plugin, onSelectionChange });

		const empty = container.querySelector(".no-mcp-servers") as HTMLElement;
		expect(empty).not.toBeNull();
		expect(empty.textContent).toContain("No MCP servers configured");
		const statusSummary = container.querySelector(
			".mcp-status span"
		) as HTMLSpanElement;
		expect(statusSummary.textContent).toContain("No MCP servers selected");
	});
});
