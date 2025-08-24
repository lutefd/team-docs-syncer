/** @jest-environment jsdom */
import { createMockApp, createMockPlugin } from "../../helpers/mockPlugin";
import type { App } from "obsidian";
import { AiProvider } from "../../../src/types/AiProvider";

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
		if ((el as any).type !== undefined && opts?.type)
			(el as any).type = opts.type;
		if (tag === "option" && opts?.value) (el as any).value = opts.value;
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

const factoryMock = {
	hasValidApiKey: jest.fn(),
	getAvailableModels: jest.fn(),
	testProvider: jest.fn(),
};
jest.mock("../../../src/factories/AiProviderFactory", () => ({
	AiProviderFactory: function () {
		return factoryMock;
	},
}));

import { ProviderChooser } from "../../../src/ui/components/ProviderChooser";

describe("ProviderChooser", () => {
	let app: App;
	let plugin: any;
	let container: HTMLElement;

	beforeEach(() => {
		jest.useFakeTimers();
		factoryMock.hasValidApiKey.mockReset();
		factoryMock.getAvailableModels.mockReset();
		factoryMock.testProvider.mockReset();

		app = createMockApp();
		plugin = createMockPlugin(app);
		container = document.createElement("div");

		factoryMock.hasValidApiKey.mockImplementation(
			(p: AiProvider) => p === AiProvider.OPENAI || p === AiProvider.OLLAMA
		);
		factoryMock.getAvailableModels.mockImplementation(
			(p: AiProvider, mode?: any) => {
				if (p === AiProvider.OPENAI)
					return [
						{ id: "gpt4o", name: "GPT-4o", provider: AiProvider.OPENAI },
						{ id: "gpt-mini", name: "GPT-mini", provider: AiProvider.OPENAI },
					];
				if (p === AiProvider.OLLAMA) {
					if (mode === "write")
						return [
							{
								id: "llama-write",
								name: "llama-write",
								provider: AiProvider.OLLAMA,
							},
						];
					return [{ id: "llama", name: "llama", provider: AiProvider.OLLAMA }];
				}
				return [];
			}
		);
		factoryMock.testProvider.mockResolvedValue(true);
	});

	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
	});

	test("renders providers, applies initial selection, and shows Ready status", async () => {
		const onSelectionChange = jest.fn();
		const chooser = new ProviderChooser(container, {
			settings: plugin.settings,
			onSelectionChange,
			initialSelection: {
				provider: AiProvider.OPENAI,
				modelId: "gpt4o",
			} as any,
		});

		expect(container.classList.contains("provider-chooser")).toBe(true);
		const providerSelect = container.querySelector(
			"select.provider-select"
		) as HTMLSelectElement;
		const modelSelect = container.querySelector(
			"select.model-select"
		) as HTMLSelectElement;

		expect(providerSelect.value).toBe(AiProvider.OPENAI);
		jest.advanceTimersByTime(0);
		expect(modelSelect.value).toBe("gpt4o");

		const options = Array.from(providerSelect.options);
		const byValue = (v: string) => options.find((o) => o.value === v)!;
		expect(byValue(AiProvider.ANTHROPIC).disabled).toBe(true);
		expect(byValue(AiProvider.GOOGLE).disabled).toBe(true);
		expect(byValue(AiProvider.OPENAI).disabled).toBe(false);

		await Promise.resolve();
		const status = container.querySelector(".provider-status") as HTMLElement;
		expect(status.textContent).toMatch(/Ready|Checking/);

		expect(onSelectionChange).toHaveBeenCalledWith({
			provider: AiProvider.OPENAI,
			modelId: "gpt4o",
		});
	});

	test("onProviderChange uses lastUsedModels, updates settings and fires callbacks", async () => {
		plugin.settings.ai.lastUsedModels = { [AiProvider.OLLAMA]: "llama" } as any;
		const onSelectionChange = jest.fn();
		const onSettingsChange = jest.fn(async () => {});

		const chooser = new ProviderChooser(container, {
			settings: plugin.settings,
			onSelectionChange,
			onSettingsChange,
		});

		const providerSelect = container.querySelector(
			"select.provider-select"
		) as HTMLSelectElement;
		const modelSelect = container.querySelector(
			"select.model-select"
		) as HTMLSelectElement;

		providerSelect.value = AiProvider.OLLAMA;
		providerSelect.dispatchEvent(new Event("change"));

		jest.advanceTimersByTime(0);
		await Promise.resolve();

		expect(modelSelect.value).toBe("llama");
		expect(onSettingsChange).toHaveBeenCalled();
		expect(onSelectionChange).toHaveBeenCalledWith({
			provider: AiProvider.OLLAMA,
			modelId: "llama",
		});
		expect(plugin.settings.ai.lastUsedProvider).toBe(AiProvider.OLLAMA);
		expect(plugin.settings.ai.lastUsedModels![AiProvider.OLLAMA]).toBe("llama");
	});

	test("selectFirstAvailableProvider picks first available and triggers onSelectionChange", async () => {
		const onSelectionChange = jest.fn();
		const chooser = new ProviderChooser(container, {
			settings: plugin.settings,
			onSelectionChange,
		});

		jest.advanceTimersByTime(0);
		await Promise.resolve();

		const providerSelect = container.querySelector(
			"select.provider-select"
		) as HTMLSelectElement;
		expect([AiProvider.OPENAI, AiProvider.OLLAMA]).toContain(
			providerSelect.value
		);
		expect(onSelectionChange).toHaveBeenCalled();
	});

	test("refresh preserves selection and updateMode repopulates models", async () => {
		const onSelectionChange = jest.fn();
		const chooser = new ProviderChooser(container, {
			settings: plugin.settings,
			onSelectionChange,
		});

		chooser.setSelection({
			provider: AiProvider.OPENAI,
			modelId: "gpt-mini",
		} as any);
		jest.advanceTimersByTime(0);
		const before = chooser.getSelection();

		chooser.refresh();
		jest.advanceTimersByTime(0);
		await Promise.resolve();
		expect(chooser.getSelection()).toEqual(before);

		const providerSelect = container.querySelector(
			"select.provider-select"
		) as HTMLSelectElement;
		providerSelect.value = AiProvider.OLLAMA;
		providerSelect.dispatchEvent(new Event("change"));
		jest.advanceTimersByTime(0);

		chooser.updateMode("write");
		expect(factoryMock.getAvailableModels).toHaveBeenCalledWith(
			AiProvider.OLLAMA,
			"write"
		);
	});
});
