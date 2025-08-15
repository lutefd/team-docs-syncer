import { Component } from "obsidian";
import { AiProvider } from "../types/AiProvider";
import { AiProviderFactory } from "../services/AiProviderFactory";
import { TeamDocsSettings } from "../types/Settings";

export interface ProviderSelection {
	provider: AiProvider;
	modelId: string;
}

export interface ProviderChooserOptions {
	settings: TeamDocsSettings;
	onSelectionChange: (selection: ProviderSelection) => void;
	onSettingsChange?: (settings: TeamDocsSettings) => Promise<void>;
	initialSelection?: ProviderSelection;
	mode?: "compose" | "write" | "chat";
}

/**
 * Provider chooser UI component for selecting AI provider and model
 */
export class ProviderChooser extends Component {
	private containerEl: HTMLElement;
	private providerSelectEl: HTMLSelectElement;
	private modelSelectEl: HTMLSelectElement;
	private statusEl: HTMLElement;
	private factory: AiProviderFactory;

	constructor(
		containerEl: HTMLElement,
		private options: ProviderChooserOptions
	) {
		super();
		this.containerEl = containerEl;
		this.factory = new AiProviderFactory(options.settings);
		this.render();
	}

	private render() {
		this.containerEl.empty();
		this.containerEl.addClass("provider-chooser");

		const providerGroup = this.containerEl.createDiv("provider-group");

		const providerLabel = providerGroup.createEl("label", {
			text: "Provider:",
			cls: "provider-label",
		});

		this.providerSelectEl = providerGroup.createEl("select", {
			cls: "provider-select",
		});

		const modelGroup = this.containerEl.createDiv("model-group");

		const modelLabel = modelGroup.createEl("label", {
			text: "Model:",
			cls: "model-label",
		});

		this.modelSelectEl = modelGroup.createEl("select", {
			cls: "model-select",
		});

		this.statusEl = this.containerEl.createDiv("provider-status");

		this.populateProviders();

		this.providerSelectEl.addEventListener("change", () => {
			this.onProviderChange();
		});

		this.modelSelectEl.addEventListener("change", () => {
			this.onModelChange();
		});

		if (this.options.initialSelection) {
			this.setSelection(this.options.initialSelection);
		} else {
			const lastUsed = this.getLastUsedSelection();
			if (lastUsed) {
				this.setSelection(lastUsed);
			} else {
				this.selectFirstAvailableProvider();
			}
		}
	}

	/**
	 * Get the last used provider/model selection from settings
	 */
	private getLastUsedSelection(): ProviderSelection | null {
		const { lastUsedProvider, lastUsedModel } = this.options.settings.ai;

		if (!lastUsedProvider || !lastUsedModel) {
			return null;
		}

		if (!this.factory.hasValidApiKey(lastUsedProvider)) {
			return null;
		}

		const availableModels = this.factory.getAvailableModels(
			lastUsedProvider,
			this.options.mode
		);
		const modelExists = availableModels.some(
			(model) => model.id === lastUsedModel
		);

		if (!modelExists) {
			return null;
		}

		return {
			provider: lastUsedProvider,
			modelId: lastUsedModel,
		};
	}

	private populateProviders() {
		this.providerSelectEl.empty();

		for (const provider of Object.values(AiProvider)) {
			const option = this.providerSelectEl.createEl("option", {
				value: provider,
				text: this.getProviderDisplayName(provider),
			});

			if (!this.factory.hasValidApiKey(provider)) {
				option.disabled = true;
				option.text += " (Not configured)";
			}
		}
	}

	private populateModels(provider: AiProvider) {
		this.modelSelectEl.empty();

		const availableModels = this.factory.getAvailableModels(
			provider,
			this.options.mode
		);

		if (availableModels.length === 0) {
			const option = this.modelSelectEl.createEl("option", {
				value: "",
				text: "No models available",
			});
			option.disabled = true;
			return;
		}

		for (const model of availableModels) {
			this.modelSelectEl.createEl("option", {
				value: model.id,
				text: model.name,
			});
		}
	}

	private onProviderChange() {
		const selectedProvider = this.providerSelectEl.value as AiProvider;
		this.populateModels(selectedProvider);
		this.updateStatus(selectedProvider);
		this.onModelChange();
	}

	private async onModelChange() {
		const provider = this.providerSelectEl.value as AiProvider;
		const modelId = this.modelSelectEl.value;

		if (provider && modelId) {
			const selection = { provider, modelId };

			this.options.settings.ai.lastUsedProvider = provider;
			this.options.settings.ai.lastUsedModel = modelId;

			if (this.options.onSettingsChange) {
				await this.options.onSettingsChange(this.options.settings);
			}

			this.options.onSelectionChange(selection);
		}
	}

	private async updateStatus(provider: AiProvider) {
		this.statusEl.empty();

		if (!this.factory.hasValidApiKey(provider)) {
			this.statusEl.createSpan({
				text: "⚠️ Not configured",
				cls: "status-warning",
			});
			return;
		}

		const loadingEl = this.statusEl.createSpan({
			text: "⏳ Checking...",
			cls: "status-loading",
		});

		try {
			const modelId = this.modelSelectEl.value;
			if (modelId) {
				const isAvailable = await this.factory.testProvider(provider, modelId);
				loadingEl.remove();

				if (isAvailable) {
					this.statusEl.createSpan({
						text: "✅ Ready",
						cls: "status-ready",
					});
				} else {
					this.statusEl.createSpan({
						text: "❌ Connection failed",
						cls: "status-error",
					});
				}
			}
		} catch (error) {
			loadingEl.remove();
			this.statusEl.createSpan({
				text: "❌ Error",
				cls: "status-error",
			});
		}
	}

	private selectFirstAvailableProvider() {
		for (const provider of Object.values(AiProvider)) {
			if (this.factory.hasValidApiKey(provider)) {
				this.providerSelectEl.value = provider;
				this.onProviderChange();
				break;
			}
		}
	}

	private getProviderDisplayName(provider: AiProvider): string {
		switch (provider) {
			case AiProvider.OPENAI:
				return "OpenAI";
			case AiProvider.ANTHROPIC:
				return "Anthropic Claude";
			case AiProvider.OLLAMA:
				return "Ollama (Local)";
			case AiProvider.GOOGLE:
				return "Google Gemini";
			default:
				return provider;
		}
	}

	public setSelection(selection: ProviderSelection) {
		this.providerSelectEl.value = selection.provider;
		this.populateModels(selection.provider);
		this.modelSelectEl.value = selection.modelId;
		this.updateStatus(selection.provider);

		this.options.onSelectionChange(selection);
	}

	public getSelection(): ProviderSelection | null {
		const provider = this.providerSelectEl.value as AiProvider;
		const modelId = this.modelSelectEl.value;

		if (provider && modelId) {
			return { provider, modelId };
		}

		return null;
	}

	public refresh() {
		const currentSelection = this.getSelection();
		this.populateProviders();

		if (currentSelection) {
			this.setSelection(currentSelection);
		} else {
			this.selectFirstAvailableProvider();
		}
	}

	public updateMode(mode: "compose" | "write" | "chat") {
		this.options.mode = mode;
		const currentProvider = this.providerSelectEl.value as AiProvider;
		if (currentProvider) {
			this.populateModels(currentProvider);
		}
	}
}
