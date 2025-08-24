/** @jest-environment jsdom */
import { App } from "obsidian";
import { createMockApp, createMockPlugin } from "../../helpers/mockPlugin";
import { MCPModal } from "../../../src/ui/modals/MCPModal";

function openModal(plugin: any, opts: any = {}) {
	const modal = new MCPModal(plugin, opts);
	modal.onOpen();
	return modal as any;
}

describe("MCPModal", () => {
	let app: App;
	let plugin: any;

	beforeEach(() => {
		(Element.prototype as any).empty = function () {
			this.innerHTML = "";
		};
		(Element.prototype as any).addClass = function (cls: string) {
			this.classList.add(cls);
		};
		(Element.prototype as any).setText = function (t: string) {
			this.textContent = t;
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
			if (opts?.type) (el as any).type = opts.type;
			if (opts?.attr) {
				for (const [k, v] of Object.entries(opts.attr))
					(el as any).setAttribute(k as string, String(v));
			}
			this.appendChild(el);
			return el;
		};

		app = createMockApp();
		plugin = createMockPlugin(app);
		plugin.mcpManager.getClientStatus = jest.fn(() => []);
	});

	test("shows message when no MCP clients configured", () => {
		plugin.settings.mcpClients = [];

		const modal = openModal(plugin);
		expect(modal.contentEl.textContent).toContain(
			"No MCP servers configured. Add servers in plugin settings."
		);
		expect(modal.contentEl.querySelectorAll(".mcp-client-item").length).toBe(0);
	});

	test("renders enabled clients, status labels, and disables non-connected", () => {
		plugin.settings.mcpClients = [
			{ id: "c1", name: "Alpha", enabled: true, transport: { type: "stdio" } },
			{ id: "c2", name: "Beta", enabled: true, transport: { type: "sse" } },
			{ id: "c3", name: "Gamma", enabled: true, transport: { type: "http" } },
			{ id: "c4", name: "Off", enabled: false, transport: { type: "stdio" } },
			{
				id: "c5",
				name: "Unknown",
				enabled: true,
				transport: { type: "stdio" },
			},
		];
		plugin.mcpManager.getClientStatus = jest.fn(() => [
			{ id: "c1", connected: true },
			{ id: "c2", connected: false },
			{ id: "c3", connected: false, lastError: "boom" },
		]);

		const modal = openModal(plugin);

		const items = Array.from(
			modal.contentEl.querySelectorAll(".mcp-client-item")
		) as HTMLElement[];
		expect(items.length).toBe(4);

		const findRow = (name: string) =>
			items.find((el) => el.textContent?.includes(name))!;

		const row1 = findRow("Alpha");
		expect(row1.querySelector(".status-connected")).toBeTruthy();
		const cb1 = row1.querySelector(".mcp-client-checkbox") as HTMLInputElement;
		expect(cb1.disabled).toBe(false);

		const row2 = findRow("Beta");
		expect(row2.querySelector(".status-disconnected")).toBeTruthy();
		const cb2 = row2.querySelector(".mcp-client-checkbox") as HTMLInputElement;
		expect(cb2.disabled).toBe(true);
		expect(row2.classList.contains("mcp-client-disabled")).toBe(true);

		const row3 = findRow("Gamma");
		const statusErr = row3.querySelector(".status-error") as HTMLElement | null;
		expect(statusErr).toBeTruthy();
		expect(statusErr?.textContent).toBe("Error");
		expect(statusErr?.getAttribute("title")).toBe("boom");
		const cb3 = row3.querySelector(".mcp-client-checkbox") as HTMLInputElement;
		expect(cb3.disabled).toBe(true);

		const row5 = findRow("Unknown");
		expect(row5.querySelector(".status-not-found")).toBeTruthy();
		const cb5 = row5.querySelector(".mcp-client-checkbox") as HTMLInputElement;
		expect(cb5.disabled).toBe(true);
	});

	test("initial selection, toggle, and apply selection", async () => {
		plugin.settings.mcpClients = [
			{ id: "c1", name: "Alpha", enabled: true, transport: { type: "stdio" } },
			{ id: "c2", name: "Beta", enabled: true, transport: { type: "stdio" } },
		];
		plugin.mcpManager.getClientStatus = jest.fn(() => [
			{ id: "c1", connected: true },
			{ id: "c2", connected: true },
		]);

		const onSelectionChange = jest.fn();
		const modal = openModal(plugin, {
			onSelectionChange,
			initialSelection: { clientIds: ["c1"] },
		});

		const rows = Array.from(
			modal.contentEl.querySelectorAll(".mcp-client-item")
		) as HTMLElement[];

		const getCheckbox = (name: string) =>
			(rows
				.find((r) => r.textContent!.includes(name))!
				.querySelector(".mcp-client-checkbox") as HTMLInputElement)!;

		const cb1 = getCheckbox("Alpha");
		const cb2 = getCheckbox("Beta");

		expect(cb1.checked).toBe(true);
		expect(cb2.checked).toBe(false);

		cb1.checked = false;
		cb1.onchange?.({} as any);
		cb2.checked = true;
		cb2.onchange?.({} as any);

		const applyBtn = Array.from(
			modal.contentEl.querySelectorAll("button")
		).find(
			(b: any) => b.textContent === "Apply Selection"
		) as HTMLButtonElement;

		applyBtn.click();

		expect(onSelectionChange).toHaveBeenCalledWith({ clientIds: ["c2"] });
	});

	test("Cancel does not call onSelectionChange", () => {
		plugin.settings.mcpClients = [
			{ id: "c1", name: "Alpha", enabled: true, transport: { type: "stdio" } },
		];
		plugin.mcpManager.getClientStatus = jest.fn(() => [
			{ id: "c1", connected: true },
		]);

		const onSelectionChange = jest.fn();
		const modal = openModal(plugin, { onSelectionChange });

		const cancelBtn = Array.from(
			modal.contentEl.querySelectorAll("button")
		).find((b: any) => b.textContent === "Cancel") as HTMLButtonElement;

		cancelBtn.click();

		expect(onSelectionChange).not.toHaveBeenCalled();
	});
});
