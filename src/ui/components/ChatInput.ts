import { Component } from "obsidian";
import TeamDocsPlugin from "../../../main";
import { ProviderChooser, ProviderSelection } from "../ProviderChooser";
import { MentionHandler } from "./MentionHandler";

export interface ChatInputOptions {
	onSend?: (message: string, providerSelection?: ProviderSelection) => void;
	onProviderChange?: (selection: ProviderSelection) => void;
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
	private providerChooser: ProviderChooser;
	private mentionHandler: MentionHandler;
	private currentProviderSelection?: ProviderSelection;
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
				console.log("[ChatInput] Provider selection changed:", selection);

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

		this.sendBtn = this.containerEl.createEl("button", {
			text: "Send",
			cls: "chatbot-send",
		});

		this.setupEventListeners();

		this.mentionHandler = new MentionHandler(this.plugin, {
			onMentionSelect: (item) => {
				console.log("[ChatInput] Mention selected:", item);
				this.updateRawContent();
			},
		});
		this.mentionHandler.initialize(this.inputEl, this.containerEl);
	}

	private setupEventListeners(): void {
		this.sendBtn.onclick = () => this.handleSend();

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

	private updateRawContent(): void {
		this.rawContent = this.inputEl.value || "";
	}

	private handleSend(): void {
		const message = (this.inputEl.value || "").trim();
		if (!message) return;

		console.log("[ChatInput] Sending message:", message);

		this.inputEl.value = "";
		this.rawContent = "";
		this.autoResizeInput();

		if (this.options.onSend) {
			this.options.onSend(message, this.currentProviderSelection);
		}
	}

	/**
	 * Get current provider selection
	 */
	public getProviderSelection(): ProviderSelection | null {
		return this.currentProviderSelection || null;
	}

	/**
	 * Set provider selection
	 */
	public setProviderSelection(selection: ProviderSelection): void {
		this.providerChooser.setSelection(selection);
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
