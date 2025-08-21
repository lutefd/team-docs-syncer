import { Component } from "obsidian";
import TeamDocsPlugin from "../../../main";
import { MentionHandler } from "./MentionHandler";
import { LinkHandler } from "./LinkHandler";
import { MCPModal, MCPSelection } from "./MCPModal";
import { ProviderChooser, ProviderSelection } from "./ProviderChooser";

export interface ChatInputOptions {
	onSend?: (
		message: string,
		providerSelection?: ProviderSelection,
		mcpSelection?: MCPSelection
	) => void;
	onProviderChange?: (selection: ProviderSelection) => void;
	onMCPChange?: (selection: MCPSelection) => void;
	placeholder?: string;
	mode?: "compose" | "write" | "chat";
}

/**
 * Component responsible for chat input area with provider chooser and mention handling
 */
export class ChatInput extends Component {
	private containerEl: HTMLElement;
	private inputEl: HTMLTextAreaElement;
	private sendBtn: HTMLButtonElement;
	private mcpBtn: HTMLButtonElement;
	private providerChooser: ProviderChooser;
	private mentionHandler: MentionHandler;
	private currentProviderSelection?: ProviderSelection;
	private currentMCPSelection: MCPSelection = { clientIds: [] };
	private inputContainer: HTMLElement;
	private rawContent: string = "";

	constructor(
		containerEl: HTMLElement,
		private plugin: TeamDocsPlugin,
		private options: ChatInputOptions = {}
	) {
		super();
		this.containerEl = containerEl;
	}

	onload(): void {
		this.render();
	}

	private render(): void {
		this.containerEl.empty();
		this.containerEl.addClass("chatbot-composer");

		const providerContainer = this.containerEl.createDiv({
			cls: "provider-chooser-container",
		});

		this.providerChooser = new ProviderChooser(providerContainer, {
			settings: this.plugin.settings,
			mode: this.options.mode,
			onSelectionChange: (selection) => {
				this.currentProviderSelection = selection;

				if (this.options.onProviderChange) {
					this.options.onProviderChange(selection);
				}
			},
			onSettingsChange: async (settings) => {
				await this.plugin.saveSettings();
			},
		});

		this.inputContainer = this.containerEl.createDiv({
			cls: "chatbot-input-container",
		});

		this.inputEl = this.inputContainer.createEl("textarea", {
			cls: "chatbot-input",
			attr: {
				placeholder: this.options.placeholder || "Ask about your team docs...",
			},
		}) as HTMLTextAreaElement;

		const buttonContainer = this.containerEl.createDiv({
			cls: "chatbot-button-container",
		});

		this.mcpBtn = buttonContainer.createEl("button", {
			text: "MCP",
			cls: "chatbot-mcp-btn",
			attr: {
				title: "Select MCP Servers",
			},
		});

		this.sendBtn = buttonContainer.createEl("button", {
			text: "Send",
			cls: "chatbot-send",
		});

		this.setupEventListeners();

		this.mentionHandler = new MentionHandler(this.plugin, {
			onMentionSelect: (item) => {
				this.updateRawContent();
			},
		});
		this.mentionHandler.initialize(this.inputEl, this.containerEl);
	}

	private setupEventListeners(): void {
		this.sendBtn.onclick = () => this.handleSend();
		this.mcpBtn.onclick = () => this.openMCPModal();

		this.inputEl.addEventListener("keydown", (e) => {
			if (this.mentionHandler.isActive()) {
				return;
			}

			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				this.handleSend();
			}
		});

		this.inputEl.addEventListener("input", () => {
			this.updateRawContent();
			this.autoResizeInput();
		});

		this.inputEl.addEventListener("focus", () => {
			this.inputContainer.addClass("is-focused");
		});

		this.inputEl.addEventListener("blur", () => {
			this.inputContainer.removeClass("is-focused");
		});
	}

	private autoResizeInput(): void {
		const minHeight = 60;
		const maxHeight = 200;
		const scrollHeight = this.inputEl.scrollHeight;

		const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
		this.inputEl.style.height = newHeight + "px";
	}

	private debounceTimer?: number;

	private openMCPModal(): void {
		const modal = new MCPModal(this.plugin, {
			initialSelection: this.currentMCPSelection,
			onSelectionChange: (selection) => {
				this.currentMCPSelection = selection;
				this.updateMCPButtonState();

				if (this.options.onMCPChange) {
					this.options.onMCPChange(selection);
				}
			},
		});
		modal.open();
	}

	private updateMCPButtonState(): void {
		const selectedCount = this.currentMCPSelection.clientIds.length;
		if (selectedCount > 0) {
			this.mcpBtn.textContent = `MCP (${selectedCount})`;
			this.mcpBtn.addClass("has-selection");
		} else {
			this.mcpBtn.textContent = "MCP";
			this.mcpBtn.removeClass("has-selection");
		}
	}

	private updateRawContent(): void {
		this.rawContent = this.inputEl.value || "";
	}

	private handleSend(): void {
		const message = (this.inputEl.value || "").trim();
		if (!message) return;

		this.inputEl.value = "";
		this.rawContent = "";
		this.autoResizeInput();

		if (this.options.onSend) {
			this.options.onSend(
				message,
				this.currentProviderSelection,
				this.currentMCPSelection
			);
		}
	}

	/**
	 * Get current provider selection
	 */
	public getProviderSelection(): ProviderSelection | null {
		return this.currentProviderSelection || null;
	}

	/**
	 * Get current MCP selection
	 */
	public getMCPSelection(): MCPSelection {
		return this.currentMCPSelection;
	}

	/**
	 * Set provider selection
	 */
	public setProviderSelection(selection: ProviderSelection): void {
		this.providerChooser.setSelection(selection);
	}

	/**
	 * Set MCP selection
	 */
	public setMCPSelection(selection: MCPSelection): void {
		this.currentMCPSelection = selection;
		this.updateMCPButtonState();
	}

	/**
	 * Get current input value
	 */
	public getValue(): string {
		return this.rawContent;
	}

	/**
	 * Set input value
	 */
	public setValue(value: string): void {
		this.rawContent = value;
		this.inputEl.value = value;
		this.autoResizeInput();
	}

	/**
	 * Focus the input
	 */
	public focus(): void {
		this.inputEl.focus();
	}

	/**
	 * Enable/disable input
	 */
	public setEnabled(enabled: boolean): void {
		this.inputEl.disabled = !enabled;
		this.sendBtn.disabled = !enabled;

		if (enabled) {
			this.containerEl.removeClass("disabled");
		} else {
			this.containerEl.addClass("disabled");
		}
	}

	/**
	 * Refresh provider chooser (useful when settings change)
	 */
	public refreshProviders(): void {
		this.providerChooser.refresh();
	}

	/**
	 * Refresh MCP chooser (useful when settings change)
	 */
	public refreshMCPs(): void {}

	/**
	 * Update mode and refresh provider models
	 */
	public updateMode(mode: "compose" | "write" | "chat"): void {
		this.options.mode = mode;
		this.providerChooser.updateMode(mode);
	}

	/**
	 * Cleanup when component is destroyed
	 */
	onunload(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}
		this.mentionHandler.unload();
		this.providerChooser.unload();
	}
}
