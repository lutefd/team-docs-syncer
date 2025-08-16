import { ItemView, WorkspaceLeaf, Notice, TFile } from "obsidian";
import TeamDocsPlugin from "../../main";
import type { ModelMessage } from "ai";
import { ChatSessionsModal } from "./ChatSessionsModal";
import { DiffModal } from "./DiffModal";
import { EditTargetModal } from "./EditTargetModal";
import { ProviderSelection } from "./ProviderChooser";
import { MessageRenderer } from "./components/MessageRenderer";
import { ChatInput } from "./components/ChatInput";
import { LinkHandler } from "./components/LinkHandler";
import { SessionManager } from "../managers/SessionManager";
import { FileContentExtractor } from "../utils/FileContentExtractor";

export const CHATBOT_VIEW = "team-docs-chatbot";

type Mode = "compose" | "write" | "chat";

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
			onSend: (message, providerSelection) =>
				this.handleSend(message, providerSelection),
			onProviderChange: (selection) => {
				this.currentProviderSelection = selection;
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
		providerSelection?: ProviderSelection
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
			await this.handleComposeMode(providerSelection);
		} else if (this.mode === "write") {
			await this.handleWriteMode(providerSelection);
		} else {
			await this.handleChatMode(providerSelection);
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
			} catch (error) {
				// Silent fail for missing files
			}
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
		const finalText = streamingMessage.contentEl.textContent || result.text;
		session.messages.push({ role: "assistant", content: finalText });
		await streamingMessage.finalize();

		this.renderSources(result.sources || []);

		await this.handleProposalsAndCreations(result);
	}

	private async handleComposeMode(
		providerSelection: ProviderSelection
	): Promise<void> {
		const session = this.plugin.chatSessionService.getActive();
		if (!session) return;

		const pinned = this.plugin.chatSessionService.getPinned();
		const lastMessage = session.messages[session.messages.length - 1];
		const searchText =
			typeof lastMessage.content === "string" ? lastMessage.content : "";
		const candidates =
			this.plugin.markdownIndexService?.search(searchText, 5) || [];

		const system: ModelMessage = {
			role: "system",
			content: `CRITICAL WORKFLOW (TOOLS FIRST):
1. Check for <attachedcontent> in user message.
2. If attachedcontent exists: Use it directly—SKIP read_doc for those files.
3. ALWAYS use search_docs for additional relevant files.
4. Use read_doc ONLY for non-attached files if needed.
5. Use follow_links for linked documents (up to 5 deep) if relevant.
6. For changes: ALWAYS use propose_edit/create_doc with COMPLETE content—NEVER output content/JSON directly.
7. After tools: Provide brief natural language summary only.

ATTACHED CONTENT RULES:
- Skip read_doc for attached files—use provided content.
- Still search_docs for related files.
- Still follow_links if attached content references others.

TOOL USAGE RULES:
- NEVER output structured data or file content.
- Cite with [[path/to/file.md|filename]].
- Be concise and accurate.${
				providerSelection.provider === "ollama"
					? `
OLLAMA-SPECIFIC (MANDATORY):
- MUST use propose_edit/create_doc for edits/creations.
- EXECUTE tools immediately—do not describe or ask confirmation.
- Tool execution is REQUIRED—do not stop early.`
					: ""
			}${
				providerSelection.modelId?.toLowerCase().includes("mistral")
					? `
MISTRAL-SPECIFIC:
- ALWAYS use <think> for reasoning/planning.
- End thinking with </think> before actions.
- Execute tools after thinking; final response is brief summary.`
					: ""
			}

${
	pinned.length > 0
		? "Prioritize pinned files, but search for more."
		: "Use search_docs for all relevant files."
} If snippets insufficient, use read_doc. Respond in user's language unless translating.`,
		};

		const contextBlurb = candidates
			.map(
				(m, i) =>
					`#${i + 1} ${m.path}\nTitle: ${
						m.title
					}\nFrontmatter: ${JSON.stringify(m.frontmatter || {})}`
			)
			.join("\n\n");

		const assistantPrep: ModelMessage = {
			role: "system",
			content: `Relevant files:\n\n${contextBlurb}\n\nPinned:\n${pinned
				.map((p, i) => `#${i + 1} ${p}`)
				.join("\n")}`,
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
				providerSelection.modelId
			);

			await this.handleStreamResult(result, streamingMessage, session);
		} catch (error) {
			streamingMessage.setPlaceholder("");
			streamingMessage.updateContent(`Error: ${error.message}`);
		}
	}

	private async handleChatMode(
		providerSelection: ProviderSelection
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
				providerSelection.modelId
			);

			await this.handleStreamResult(result, streamingMessage, session);
		} catch (error) {
			streamingMessage.setPlaceholder("");
			streamingMessage.updateContent(`Error: ${error.message}`);
		}
	}

	private async handleWriteMode(
		providerSelection: ProviderSelection
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

		await this.generateEditWithStreamChat(picked, providerSelection);
	}

	private async generateEditWithStreamChat(
		path: string,
		providerSelection: ProviderSelection
	): Promise<void> {
		const session = this.plugin.chatSessionService.getActive();
		if (!session) return;

		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			new Notice("File not found");
			return;
		}

		const editSystem: ModelMessage = {
			role: "system",
			content: `CRITICAL WORKFLOW (TOOLS FIRST) for editing ${path}:
1. ALWAYS use read_doc to get current content.
2. Then use propose_edit with COMPLETE updated content.
3. NEVER output content directly—use propose_edit.
4. After tool: Provide brief summary only.

TOOL USAGE RULES:
- Maintain existing structure/style unless requested.
- Cite with [[path/to/file.md|filename]].${
				providerSelection.modelId?.toLowerCase().includes("mistral")
					? `
MISTRAL-SPECIFIC:
- ALWAYS use <think> for reasoning.
- End with </think> before actions.
- Execute tools after thinking; final response is summary.`
					: ""
			}`,
		};

		const fileContext: ModelMessage = {
			role: "user",
			content: `Edit ${path}: Apply requested changes, keeping structure/style intact unless specified.`,
		};

		const streamingMessage = this.createStreamingMessage();
		streamingMessage.setPlaceholder("📖 Reading file and preparing changes...");

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
				providerSelection.modelId
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
