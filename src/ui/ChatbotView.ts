import { ItemView, WorkspaceLeaf, Notice, TFile } from "obsidian";
import TeamDocsPlugin from "../../main";
import type { ModelMessage } from "ai";
import { ChatSessionsModal } from "./modals/ChatSessionsModal";
import { DiffModal } from "./modals/DiffModal";
import { EditTargetModal } from "./modals/EditTargetModal";
import { ProviderSelection } from "./components/ProviderChooser";
import { MCPSelection } from "./components/MCPChooser";
import { MessageRenderer } from "./components/MessageRenderer";
import { ChatInput } from "./components/ChatInput";
import { LinkHandler } from "./components/LinkHandler";
import { SessionManager } from "../managers/SessionManager";
import { FileContentExtractor } from "../utils/FileContentExtractor";
import {
	buildComposeSystemPrompt,
	buildEditSystemPrompt,
	buildContextualPrompt,
	buildEditContextPrompt,
	Mode,
} from "../instructions";

export const CHATBOT_VIEW = "team-docs-chatbot";

export class ChatbotView extends ItemView {
	private plugin: TeamDocsPlugin;
	private mode: Mode = "compose";
	private container!: HTMLElement;
	private sourcesEl!: HTMLElement;
	private messagesEl!: HTMLElement;
	private pinsEl!: HTMLElement;

	private messageRenderer: MessageRenderer;
	private chatInput: ChatInput;
	private linkHandler: LinkHandler;
	private sessionManager: SessionManager;
	private fileContentExtractor: FileContentExtractor;
	private currentProviderSelection?: ProviderSelection;
	private currentMCPSelection?: MCPSelection;
	private resizeObserver?: ResizeObserver;

	constructor(leaf: WorkspaceLeaf, plugin: TeamDocsPlugin) {
		super(leaf);
		this.plugin = plugin;

		this.linkHandler = new LinkHandler(plugin, {
			onOpenFile: (path) => this.openFile(path),
		});

		this.fileContentExtractor = new FileContentExtractor(this.app);

		this.messageRenderer = new MessageRenderer(plugin, {
			onFixInternalLinks: (container) =>
				this.linkHandler.fixInternalLinks(container),
		});

		this.sessionManager = new SessionManager(plugin, {
			onPinsChange: () => this.renderPins(),
		});

		this.addChild(this.messageRenderer);
		this.addChild(this.linkHandler);
		this.addChild(this.sessionManager);
	}

	getViewType(): string {
		return CHATBOT_VIEW;
	}

	getDisplayText(): string {
		return "Docs Chatbot";
	}

	getIcon(): string {
		return "bot";
	}

	async onOpen(): Promise<void> {
		await this.plugin.markdownIndexService?.init();

		const lastUsedMode = this.plugin.settings.ai.lastUsedMode;
		if (lastUsedMode) {
			this.mode = lastUsedMode;
		}

		const container = (this.container = this.containerEl
			.children[1] as HTMLElement);
		container.empty();
		container.addClass("team-chatbot-view", "chatbot-view");

		this.setupResponsiveDetection(container);

		const header = container.createDiv({ cls: "chatbot-header" });

		this.pinsEl = container.createDiv({ cls: "chatbot-pins" });
		this.renderPins();

		this.sessionManager.createSessionsButton(header, () => {
			new ChatSessionsModal(this.app, this.plugin, () =>
				this.renderMessages()
			).open();
		});

		this.sourcesEl = container.createDiv({ cls: "chatbot-sources" });

		this.messagesEl = container.createDiv({ cls: "chatbot-messages" });
		await this.renderMessages();

		const composerContainer = container.createDiv({
			cls: "chatbot-composer-container",
		});
		this.chatInput = new ChatInput(composerContainer, this.plugin, {
			onSend: (message, providerSelection, mcpSelection) =>
				this.handleSend(message, providerSelection, mcpSelection),
			onProviderChange: (selection) => {
				this.currentProviderSelection = selection;
			},
			onMCPChange: (selection) => {
				this.currentMCPSelection = selection;
			},
			placeholder: "Ask about your team docs...",
			mode: this.mode,
		});

		this.addChild(this.chatInput);

		this.sessionManager.createModeToggle(header, this.mode, (mode) => {
			this.mode = mode;
			this.plugin.settings.ai.lastUsedMode = mode;
			this.plugin.saveSettings();
			this.chatInput?.updateMode(mode);
		});
	}

	async onClose(): Promise<void> {
		this.messageRenderer?.unload();
		this.chatInput?.unload();
		this.linkHandler?.unload();
		this.sessionManager?.unload();
		this.resizeObserver?.disconnect();
	}

	private setupResponsiveDetection(container: HTMLElement): void {
		this.resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const width = entry.contentRect.width;
				this.updateResponsiveClasses(container, width);
			}
		});

		this.resizeObserver.observe(container);

		const initialWidth = container.getBoundingClientRect().width;
		this.updateResponsiveClasses(container, initialWidth);
	}

	private updateResponsiveClasses(container: HTMLElement, width: number): void {
		container.removeClass("narrow", "very-narrow", "extremely-narrow");

		if (width <= 380) {
			container.addClass("extremely-narrow");
		} else if (width <= 450) {
			container.addClass("very-narrow");
		} else if (width <= 617) {
			container.addClass("narrow");
		}
	}

	private renderPins(): void {
		this.sessionManager.renderPins(this.pinsEl);
	}

	private async renderMessages(): Promise<void> {
		const session = this.plugin.chatSessionService.getActive();
		if (!session) {
			this.messagesEl.empty();
			return;
		}

		await this.messageRenderer.renderMessages(
			this.messagesEl,
			session.messages
		);
	}

	private renderSources(sources: string[]): void {
		if (sources.length > 0) {
			this.sessionManager.renderSources(this.sourcesEl, sources);
		} else {
			this.sourcesEl.empty();
		}
	}

	private async handleSend(
		message: string,
		providerSelection?: ProviderSelection,
		mcpSelection?: MCPSelection
	): Promise<void> {
		if (!providerSelection) {
			new Notice("Please select an AI provider and model.");
			return;
		}

		if (!this.plugin.aiService?.hasApiKey(providerSelection.provider)) {
			new Notice(`${providerSelection.provider} API key is missing.`);
			return;
		}

		const session = this.plugin.chatSessionService.getActive();
		if (!session) return;

		if (session.messages.length === 0) {
			this.plugin.chatSessionService.rename(
				session.id,
				message.length > 50 ? message.slice(0, 50) + "…" : message
			);
		}

		let userMessageContent = message;
		if (this.mode === "chat") {
			userMessageContent =
				await this.fileContentExtractor.processTextWithAttachments(message);
		}

		this.appendMessage({ role: "user", content: userMessageContent });

		if (this.mode === "chat" || this.mode === "compose") {
			await this.processMentionsAndAttachments(session, message);
		}

		if (this.mode === "compose") {
			await this.handleComposeMode(providerSelection, mcpSelection);
		} else if (this.mode === "write") {
			await this.handleWriteMode(providerSelection, mcpSelection);
		} else if (this.mode === "chat") {
			await this.handleChatMode(providerSelection, mcpSelection);
		}
	}

	private async processMentionsAndAttachments(
		session: any,
		originalMessage: string
	): Promise<void> {
		if (session.messages.length === 0) return;

		const lastMessage = session.messages[session.messages.length - 1];
		if (lastMessage.role !== "user") return;

		const mentionRegex = /\[\[([^\]]+?)(?:\|[^\]]+)?\]\]/g;
		const mentions: string[] = [];
		let match;
		while ((match = mentionRegex.exec(originalMessage)) !== null) {
			mentions.push(match[1]);
		}

		const cleanMessage = originalMessage
			.replace(/\[\[([^\]]+)\|([^\]]+)\]\]/g, "$2")
			.replace(/\[\[([^\]]+)\]\]/g, "$1");

		lastMessage.content = cleanMessage;

		if (mentions.length === 0) return;

		const attachedFiles: string[] = [];
		for (const path of mentions) {
			try {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file instanceof TFile) {
					const content = await this.app.vault.read(file);
					attachedFiles.push(`File: ${path}\n\n${content}`);
				}
			} catch (error) {}
		}

		if (attachedFiles.length > 0) {
			const attachedContent = `<attachedcontent>\n${attachedFiles.join(
				"\n\n---\n\n"
			)}\n</attachedcontent>`;
			lastMessage.content = cleanMessage + "\n\n" + attachedContent;
		}
	}

	private createStreamingMessage() {
		const streamingMessage = this.messageRenderer.createStreamingMessage(
			this.messagesEl
		);
		streamingMessage.setPlaceholder("💭 Thinking...");
		return streamingMessage;
	}

	private async handleStreamResult(
		result: any,
		streamingMessage: any,
		session: any
	) {
		if (result?.reasoningSummary) {
			try {
				streamingMessage.addThinkingSection(result.reasoningSummary);
			} catch (_) {}
		}
		if (result?.reasoningText) {
			try {
				streamingMessage.addThinkingSection("\n" + result.reasoningText + "\n");
			} catch (_) {}
		}
		const finalText = streamingMessage.contentEl.textContent || result.text;
		session.messages.push({ role: "assistant", content: finalText });
		await streamingMessage.finalize();

		this.renderSources(result.sources || []);

		await this.handleProposalsAndCreations(result);
	}

	private async handleComposeMode(
		providerSelection: ProviderSelection,
		mcpSelection?: MCPSelection
	): Promise<void> {
		const session = this.plugin.chatSessionService.getActive();
		if (!session) return;

		const pinned = this.plugin.chatSessionService.getPinned();
		const lastMessage = session.messages[session.messages.length - 1];
		const searchText =
			typeof lastMessage.content === "string" ? lastMessage.content : "";
		const candidates =
			this.plugin.markdownIndexService?.search(searchText, 5) || [];

		const systemContent = buildComposeSystemPrompt({
			providerSelection,
			pinnedFiles: pinned,
		});

		const system: ModelMessage = {
			role: "system",
			content: systemContent,
		};

		const assistantPrepContent = buildContextualPrompt({
			candidates,
			pinnedFiles: pinned,
		});

		const assistantPrep: ModelMessage = {
			role: "system",
			content: assistantPrepContent,
		};

		const msgList = [system, assistantPrep, ...session.messages];

		const streamingMessage = this.createStreamingMessage();

		try {
			const result = await this.plugin.aiService!.streamChat(
				msgList,
				this.mode,
				(delta) => {
					streamingMessage.appendContent(delta);
				},
				(status) => {
					streamingMessage.setPlaceholder(status);
				},
				(thoughts) => streamingMessage.addThinkingSection(thoughts),
				(placeholder) => streamingMessage.setPlaceholder(placeholder),
				providerSelection.provider,
				providerSelection.modelId,
				mcpSelection
			);

			await this.handleStreamResult(result, streamingMessage, session);
		} catch (error) {
			streamingMessage.setPlaceholder("");
			streamingMessage.updateContent(`Error: ${error.message}`);
		}
	}

	private async handleChatMode(
		providerSelection: ProviderSelection,
		mcpSelection?: MCPSelection
	): Promise<void> {
		const session = this.plugin.chatSessionService.getActive();
		if (!session) return;

		const streamingMessage = this.createStreamingMessage();

		try {
			const result = await this.plugin.aiService!.streamChat(
				session.messages,
				"chat",
				(delta) => {
					streamingMessage.appendContent(delta);
				},
				(status) => {
					streamingMessage.setPlaceholder(status);
				},
				(thoughts) => streamingMessage.addThinkingSection(thoughts),
				(placeholder) => streamingMessage.setPlaceholder(placeholder),
				providerSelection.provider,
				providerSelection.modelId,
				mcpSelection
			);

			await this.handleStreamResult(result, streamingMessage, session);
		} catch (error) {
			streamingMessage.setPlaceholder("");
			streamingMessage.updateContent(`Error: ${error.message}`);
		}
	}

	private async handleWriteMode(
		providerSelection: ProviderSelection,
		mcpSelection?: MCPSelection
	): Promise<void> {
		const messages = this.plugin.chatSessionService.getActive()?.messages;
		const lastMessage =
			messages && messages.length > 0
				? messages[messages.length - 1]
				: undefined;
		if (!lastMessage?.content) return;

		const searchText =
			typeof lastMessage.content === "string" ? lastMessage.content : "";
		if (!searchText) return;

		const candidates =
			this.plugin.markdownIndexService?.search(searchText, 5) || [];

		const picked = await new Promise<string | null>((resolve) => {
			new EditTargetModal(
				this.app,
				this.plugin,
				candidates.map((c) => c.path),
				(p) => resolve(p)
			).open();
		});

		if (!picked) return;

		await this.generateEditWithStreamChat(
			picked,
			providerSelection,
			mcpSelection
		);
	}

	private async generateEditWithStreamChat(
		path: string,
		providerSelection: ProviderSelection,
		mcpSelection?: MCPSelection
	): Promise<void> {
		const session = this.plugin.chatSessionService.getActive();
		if (!session) return;

		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			new Notice("File not found");
			return;
		}

		const editSystemContent = buildEditSystemPrompt({
			filePath: path,
			providerSelection,
		});

		const editSystem: ModelMessage = {
			role: "system",
			content: editSystemContent,
		};

		const fileContextContent = buildEditContextPrompt(path);

		const fileContext: ModelMessage = {
			role: "user",
			content: fileContextContent,
		};

		const streamingMessage = this.createStreamingMessage();
		streamingMessage.setPlaceholder(
			"📂 Gathering context and preparing changes..."
		);

		try {
			const result = await this.plugin.aiService!.streamChat(
				[editSystem, ...session.messages, fileContext],
				"write",
				(delta) => {
					streamingMessage.appendContent(delta);
				},
				(status) => {
					streamingMessage.setPlaceholder(status);
				},
				(thoughts) => streamingMessage.addThinkingSection(thoughts),
				(placeholder) => streamingMessage.setPlaceholder(placeholder),
				providerSelection.provider,
				providerSelection.modelId,
				mcpSelection
			);

			await this.handleStreamResult(result, streamingMessage, session);
		} catch (error) {
			streamingMessage.setPlaceholder("");
			streamingMessage.updateContent(`Error: ${error.message}`);
		}
	}

	private async handleProposalsAndCreations(result: any): Promise<void> {
		if (result.proposals?.length) {
			for (const proposal of result.proposals) {
				if (!proposal.path || !proposal.content) continue;

				const file = this.app.vault.getAbstractFileByPath(proposal.path);
				const originalContent =
					file instanceof TFile ? await this.app.vault.read(file) : "";

				new DiffModal(
					this.app,
					proposal.path,
					originalContent,
					proposal.content,
					async (confirmed: boolean, editedContent?: string) => {
						if (!confirmed) return;

						try {
							const contentToApply = editedContent || proposal.content;
							if (file instanceof TFile) {
								await this.app.vault.modify(file, contentToApply);
							} else {
								const folderPath = proposal.path
									.split("/")
									.slice(0, -1)
									.join("/");
								if (folderPath) await this.app.vault.createFolder(folderPath);
								await this.app.vault.create(proposal.path, contentToApply);
							}
							new Notice(`Updated ${proposal.path}`);
						} catch (error) {
							new Notice(`Failed to update ${proposal.path}: ${error.message}`);
						}
					}
				).open();
			}
		}

		if (result.creations?.length) {
			for (const creation of result.creations) {
				if (creation.path) {
					new Notice(`Created file: ${creation.path}`);
				}
			}
		}
	}

	private appendMessage(message: ModelMessage): void {
		const session = this.plugin.chatSessionService.getActive();
		if (session) {
			session.messages.push(message);
			this.messageRenderer.renderMessage(this.messagesEl, message);
		}
	}

	private openFile(path: string): void {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			this.app.workspace.getLeaf().openFile(file);
		}
	}
}
