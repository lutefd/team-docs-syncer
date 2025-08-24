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
		this.appendChild(el);
		return el;
	};
});

const providerInstances: any[] = [];
jest.mock("../../../src/ui/components/ProviderChooser", () => {
	return {
		ProviderChooser: function (
			this: any,
			_container: HTMLElement,
			options: any
		) {
			this.options = options;
			this.setSelection = jest.fn();
			this.refresh = jest.fn();
			this.updateMode = jest.fn();
			this.unload = jest.fn();
			providerInstances.push(this);
		},
	};
});

const mentionInstances: any[] = [];
jest.mock("../../../src/ui/components/MentionHandler", () => {
	return {
		MentionHandler: function (this: any, _plugin: any, options: any) {
			this.options = options;
			this.initialize = jest.fn();
			this.isActive = jest.fn(() => false);
			this.unload = jest.fn();
			mentionInstances.push(this);
		},
	};
});

const mcpModalInstances: any[] = [];
jest.mock("../../../src/ui/modals/MCPModal", () => {
	return {
		MCPModal: function (this: any, _plugin: any, options: any) {
			this.options = options;
			this.open = jest.fn();
			mcpModalInstances.push(this);
		},
	};
});

import { ChatInput } from "../../../src/ui/components/ChatInput";

describe("ChatInput", () => {
	let app: App;
	let plugin: any;
	let container: HTMLElement;

	beforeEach(() => {
		app = createMockApp();
		plugin = createMockPlugin(app);
		container = document.createElement("div");
		providerInstances.length = 0;
		mentionInstances.length = 0;
		mcpModalInstances.length = 0;
	});

	test("renders input and buttons with placeholder and initializes subcomponents", () => {
		const chat = new ChatInput(container, plugin, {
			placeholder: "Type here...",
		});
		chat.onload();

		expect(container.classList.contains("chatbot-composer")).toBe(true);
		const textarea = container.querySelector(
			"textarea.chatbot-input"
		) as HTMLTextAreaElement;
		expect(textarea?.getAttribute("placeholder")).toBe("Type here...");
		expect(container.querySelector("button.chatbot-send")?.textContent).toBe(
			"Send"
		);
		expect(container.querySelector("button.chatbot-mcp-btn")?.textContent).toBe(
			"MCP"
		);

		expect(providerInstances.length).toBe(1);
		expect(mentionInstances.length).toBe(1);
	});

	test("send via button click trims, clears, resizes and calls onSend with selections", () => {
		const onSend = jest.fn();
		const chat = new ChatInput(container, plugin, { onSend });
		chat.onload();

		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		const sendBtn = container.querySelector(
			"button.chatbot-send"
		) as HTMLButtonElement;

		textarea.value = "  Hello  ";
		sendBtn.click();

		expect(onSend).toHaveBeenCalledWith("Hello", undefined, { clientIds: [] });
		expect(textarea.value).toBe("");
		expect(chat.getValue()).toBe("");
	});

	test("send via Ctrl/Cmd+Enter and ignored when mention menu active", () => {
		const onSend = jest.fn();
		const chat = new ChatInput(container, plugin, { onSend });
		chat.onload();
		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;

		(mentionInstances[0].isActive as jest.Mock).mockReturnValueOnce(true);
		textarea.value = "Ignore";
		textarea.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true })
		);
		expect(onSend).not.toHaveBeenCalled();

		textarea.value = "Go";
		textarea.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Enter", metaKey: true })
		);
		expect(onSend).toHaveBeenCalled();
	});

	test("MCP modal selection updates button and triggers onMCPChange", () => {
		const onMCPChange = jest.fn();
		const chat = new ChatInput(container, plugin, { onMCPChange });
		chat.onload();

		const mcpBtn = container.querySelector(
			"button.chatbot-mcp-btn"
		) as HTMLButtonElement;
		mcpBtn.click();
		expect(mcpModalInstances.length).toBe(1);

		mcpModalInstances[0].options.onSelectionChange({ clientIds: ["a", "b"] });
		expect(onMCPChange).toHaveBeenCalledWith({ clientIds: ["a", "b"] });
		expect(mcpBtn.textContent).toBe("MCP (2)");
		expect(mcpBtn.classList.contains("has-selection")).toBe(true);
	});

	test("setMCPSelection directly updates button state", () => {
		const chat = new ChatInput(container, plugin, {});
		chat.onload();
		const mcpBtn = container.querySelector(
			"button.chatbot-mcp-btn"
		) as HTMLButtonElement;

		chat.setMCPSelection({ clientIds: ["x"] });
		expect(mcpBtn.textContent).toBe("MCP (1)");
		expect(mcpBtn.classList.contains("has-selection")).toBe(true);

		chat.setMCPSelection({ clientIds: [] });
		expect(mcpBtn.textContent).toBe("MCP");
		expect(mcpBtn.classList.contains("has-selection")).toBe(false);
	});

	test("provider selection callbacks and setProviderSelection", () => {
		const onProviderChange = jest.fn();
		const chat = new ChatInput(container, plugin, { onProviderChange });
		chat.onload();

		const selection = { providerId: "openai", modelId: "gpt-4o-mini" } as any;
		providerInstances[0].options.onSelectionChange(selection);
		expect(onProviderChange).toHaveBeenCalledWith(selection);
		expect(chat.getProviderSelection()).toEqual(selection);

		const selection2 = { providerId: "ollama", modelId: "llama" } as any;
		chat.setProviderSelection(selection2);
		expect(providerInstances[0].setSelection).toHaveBeenCalledWith(selection2);
	});

	test("input focus/blur toggles is-focused class", () => {
		const chat = new ChatInput(container, plugin, {});
		chat.onload();
		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		const wrapper = container.querySelector(
			".chatbot-input-container"
		) as HTMLElement;

		textarea.dispatchEvent(new FocusEvent("focus"));
		expect(wrapper.classList.contains("is-focused")).toBe(true);

		textarea.dispatchEvent(new FocusEvent("blur"));
		expect(wrapper.classList.contains("is-focused")).toBe(false);
	});

	test("setValue/getValue and setEnabled", () => {
		const chat = new ChatInput(container, plugin, {});
		chat.onload();

		chat.setValue("abc");
		expect(chat.getValue()).toBe("abc");

		chat.setEnabled(false);
		expect(container.classList.contains("disabled")).toBe(true);
		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		const sendBtn = container.querySelector(
			"button.chatbot-send"
		) as HTMLButtonElement;
		expect(textarea.disabled).toBe(true);
		expect(sendBtn.disabled).toBe(true);

		chat.setEnabled(true);
		expect(container.classList.contains("disabled")).toBe(false);
		expect(textarea.disabled).toBe(false);
		expect(sendBtn.disabled).toBe(false);
	});

	test("updateMode delegates to provider chooser and refresh providers", () => {
		const chat = new ChatInput(container, plugin, { mode: "chat" });
		chat.onload();

		chat.updateMode("write");
		expect(providerInstances[0].updateMode).toHaveBeenCalledWith("write");

		chat.refreshProviders();
		expect(providerInstances[0].refresh).toHaveBeenCalled();
	});

	test("onunload cleans up child components", () => {
		const chat = new ChatInput(container, plugin, {});
		chat.onload();

		chat.onunload();
		expect(mentionInstances[0].unload).toHaveBeenCalled();
		expect(providerInstances[0].unload).toHaveBeenCalled();
	});
});
