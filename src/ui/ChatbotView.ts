import {
	ItemView,
	WorkspaceLeaf,
	Notice,
	MarkdownRenderer,
	TFile,
} from "obsidian";
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
		void this.plugin.markdownIndexService?.init();

		const lastUsedMode = this.plugin.settings.ai.lastUsedMode;
		if (lastUsedMode) {
			this.mode = lastUsedMode;
		}

		const container = (this.container = this.containerEl
			.children[1] as HTMLElement);
		container.empty();
		container.addClass("team-chatbot-view");
		container.addClass("chatbot-view");

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
		this.renderMessages();

		const composerContainer = container.createDiv({
			cls: "chatbot-composer-container",
		});
		this.chatInput = new ChatInput(composerContainer, this.plugin, {
			onSend: (message, providerSelection) =>
				this.handleSend(message, providerSelection),
			onProviderChange: (selection) => {
				this.currentProviderSelection = selection;
			},
			placeholder: "Ask about your vault...",
			mode: this.mode,
		});

		this.addChild(this.chatInput);

		this.sessionManager.createModeToggle(header, this.mode, (mode) => {
			this.mode = mode;
			this.plugin.settings.ai.lastUsedMode = mode;
			this.plugin.saveSettings();
			if (this.chatInput) {
				this.chatInput.updateMode(mode);
			}
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

		console.log(
			`[ChatbotView] Container width: ${width}px, applied classes:`,
			container.className
				.split(" ")
				.filter((cls) =>
					["narrow", "very-narrow", "extremely-narrow"].includes(cls)
				)
		);
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
		this.sessionManager.renderSources(this.sourcesEl, sources);
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
			new Notice(
				`${providerSelection.provider} API key is missing in settings.`
			);
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

		let processedMessage = message;
		if (this.mode === "chat") {
			console.log("[ChatbotView] Processing message in chat mode:", message);
			processedMessage =
				await this.fileContentExtractor.processTextWithAttachments(message);
			console.log("[ChatbotView] Processed message:", processedMessage);
		}

		this.appendMessage({ role: "user", content: processedMessage });

		if (this.mode === "compose") {
			await this.handleComposeMode(processedMessage, providerSelection);
		} else if (this.mode === "write") {
			await this.handleWriteMode(processedMessage, providerSelection);
		} else {
			await this.handleChatMode(processedMessage, providerSelection);
		}
	}

	private async handleComposeMode(
		message: string,
		providerSelection: ProviderSelection
	): Promise<void> {
		const session = this.plugin.chatSessionService.getActive();
		if (!session) return;

		const mentionRegex = /\[\[([^\]]+?)(?:\|[^\]]+)?\]\]/g;
		const mentions: string[] = [];
		let match;

		while ((match = mentionRegex.exec(message)) !== null) {
			mentions.push(match[1]);
		}

		const cleanMessage = message
			.replace(/\[\[([^\]]+)\|([^\]]+)\]\]/g, "$2")
			.replace(/\[\[([^\]]+)\]\]/g, "$1");

		if (session.messages.length > 0) {
			const lastMessage = session.messages[session.messages.length - 1];
			if (lastMessage.role === "user") {
				lastMessage.content = cleanMessage;
			}
		}

		let attachedContent = "";
		if (mentions.length > 0) {
			const attachedFiles: string[] = [];
			for (const mentionPath of mentions) {
				try {
					const file = this.app.vault.getAbstractFileByPath(mentionPath);
					if (file instanceof TFile) {
						const content = await this.app.vault.read(file);
						attachedFiles.push(`File: ${mentionPath}\n\n${content}`);
					}
				} catch (error) {
					console.warn(
						`[ChatbotView] Could not read mentioned file: ${mentionPath}`,
						error
					);
				}
			}

			if (attachedFiles.length > 0) {
				attachedContent = `<attachedcontent>\n${attachedFiles.join(
					"\n\n---\n\n"
				)}\n</attachedcontent>`;
				session.messages[session.messages.length - 1].content =
					cleanMessage + "\n\n" + attachedContent;
			}
		}

		const pinned = this.plugin.chatSessionService.getPinned();
		const candidates =
			this.plugin.markdownIndexService?.search(message, 5) || [];

		const system: ModelMessage = {
			role: "system",
			content: `You are a helpful assistant for Obsidian vault management. You can work with files across the entire vault.

CRITICAL WORKFLOW:
1. Check if <attachedcontent> tags are present in the user message
2. If attachedcontent exists: Use that content directly - NO need to read_doc those specific files
3. ALWAYS use search_docs tool to find additional relevant files
4. Use read_doc ONLY for files NOT already provided in attachedcontent
5. Use follow_links to gather comprehensive context from linked documents
6. When making changes, ALWAYS use propose_edit or create_doc tools - NEVER output JSON or file content directly
7. After using tools, provide a brief natural language summary

ATTACHED CONTENT OPTIMIZATION:
- If user mentions files with [[filename]], their content is provided in <attachedcontent> tags
- Skip read_doc for files already in attachedcontent - use that content directly
- Still search_docs to discover related files not mentioned by user
- Still follow_links if attached content references other documents
- Only read_doc files that are discovered but not already attached

TOOL USAGE RULES:
- NEVER output structured data, JSON, or file content in your response
- ALWAYS use propose_edit with complete file content when editing
- ALWAYS use create_doc when creating new files
- Your final response should only be a natural language summary of what you accomplished

${
	providerSelection.provider === "ollama"
		? `
OLLAMA-SPECIFIC ENFORCEMENT:
- If user requests editing or creating files, you MUST use propose_edit or create_doc tools
- DO NOT output translations, document content, or what "should be" in the document
- DO NOT stop until you have actually used the appropriate tool
- NEVER provide the content as text - ALWAYS use the tools
- Your job is not complete until the tool has been executed
`
		: ""
}

${
	providerSelection.modelId?.toLowerCase().includes("mistral")
		? `
MISTRAL-SPECIFIC ENFORCEMENT:
- ALWAYS use <think> tags when formulating your response or reasoning through problems
- Put ALL your reasoning, planning, and thought process inside <think></think> tags
- Close your thinking with </think> before taking any actions or giving final answers
- DO NOT think out loud as your final answer - use the thinking tags properly
- You can use multiple tools during the process as needed (search, read, edit, create, etc.)
- You do NOT need user confirmation to make edits - proceed directly with propose_edit or create_doc
- After thinking, immediately execute the required tools (propose_edit, create_doc, etc.)
- Your final response should only be a brief summary after tool execution
`
		: ""
}
}

${
	pinned.length > 0
		? "The user has pinned specific files - search these first, but also search for additional relevant files across the vault."
		: "Use search_docs to find all relevant files across the entire vault."
} If search_docs snippets are insufficient, use read_doc to get full file content. IMPORTANT: After reading any document with read_doc, if it has in it's content any links with the format [[path/to/file.md|filename]], use the follow_links tool on that document's content to gather comprehensive context from linked documents (up to 5 documents deep) if the link is not found in the search_docs and it's relevant. Do not skip this step even if you think the document doesn't contain links. Always cite file paths using Obsidian format [[path/to/file.md|filename]]. Be concise but accurate.`,
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
			content: `Relevant files from vault search (by title/frontmatter):\n\n${contextBlurb}\n\nPinned files:\n${pinned
				.map((p, i) => `#${i + 1} ${p}`)
				.join("\n")}`,
		};

		const msgList = [
			system,
			assistantPrep,
			...session.messages,
		] as ModelMessage[];

		const streamingMessage = this.messageRenderer.createStreamingMessage(
			this.messagesEl
		);
		streamingMessage.setThinking(true);

		try {
			const result = await this.plugin.aiService!.streamChat(
				msgList,
				this.mode,
				(delta) => {
					streamingMessage.appendContent(delta);
					streamingMessage.setThinking(false);
				},
				(status) => {
					streamingMessage.contentEl.textContent = status;
					streamingMessage.setThinking(true);
				},
				(thoughts) => {
					streamingMessage.addThinkingSection(thoughts);
				},
				providerSelection.provider,
				providerSelection.modelId
			);

			const finalText =
				streamingMessage.contentEl.textContent || result.text || "";
			session.messages.push({ role: "assistant", content: finalText });
			await streamingMessage.finalize();

			const finalSources = result.sources?.length ? result.sources : [];
			if (finalSources.length) {
				this.renderSources(finalSources);
			}

			await this.handleProposalsAndCreations(result);
		} catch (error) {
			streamingMessage.setThinking(false);
			streamingMessage.updateContent(
				`Error: ${error instanceof Error ? error.message : "Unknown error"}`
			);
			console.error("[ChatbotView] Chat error:", error);
		}
	}

	private async handleChatMode(
		message: string,
		providerSelection: ProviderSelection
	): Promise<void> {
		const session = this.plugin.chatSessionService.getActive();
		if (!session) return;

		const mentionRegex = /\[\[([^\]]+?)(?:\|[^\]]+)?\]\]/g;
		const mentions: string[] = [];
		let match;

		while ((match = mentionRegex.exec(message)) !== null) {
			mentions.push(match[1]);
		}

		const cleanMessage = message
			.replace(/\[\[([^\]]+)\|([^\]]+)\]\]/g, "$2")
			.replace(/\[\[([^\]]+)\]\]/g, "$1");

		if (session.messages.length > 0) {
			const lastMessage = session.messages[session.messages.length - 1];
			if (lastMessage.role === "user") {
				lastMessage.content = cleanMessage;
			}
		}

		let attachedContent = "";
		if (mentions.length > 0) {
			const attachedFiles: string[] = [];
			for (const mentionPath of mentions) {
				try {
					const file = this.app.vault.getAbstractFileByPath(mentionPath);
					if (file instanceof TFile) {
						const content = await this.app.vault.read(file);
						attachedFiles.push(`File: ${mentionPath}\n\n${content}`);
					}
				} catch (error) {
					console.warn(
						`[ChatbotView] Could not read mentioned file: ${mentionPath}`,
						error
					);
				}
			}

			if (attachedFiles.length > 0) {
				attachedContent = `<attachedcontent>\n${attachedFiles.join(
					"\n\n---\n\n"
				)}\n</attachedcontent>`;
				session.messages[session.messages.length - 1].content =
					cleanMessage + "\n\n" + attachedContent;
			}
		}

		const streamingMessage = this.messageRenderer.createStreamingMessage(
			this.messagesEl
		);
		streamingMessage.setThinking(true);

		try {
			const result = await this.plugin.aiService!.streamChat(
				session.messages,
				"chat",
				(delta) => {
					streamingMessage.appendContent(delta);
					streamingMessage.setThinking(false);
				},
				(status) => {
					streamingMessage.contentEl.textContent = status;
					streamingMessage.setThinking(true);
				},
				(thoughts) => {
					streamingMessage.addThinkingSection(thoughts);
				},
				providerSelection.provider,
				providerSelection.modelId
			);

			const finalText =
				streamingMessage.contentEl.textContent || result.text || "";
			session.messages.push({ role: "assistant", content: finalText });
			await streamingMessage.finalize();
		} catch (error) {
			streamingMessage.setThinking(false);
			streamingMessage.updateContent(
				`Error: ${error instanceof Error ? error.message : "Unknown error"}`
			);
			console.error("[ChatbotView] Chat error:", error);
		}
	}

	private async handleWriteMode(
		message: string,
		providerSelection: ProviderSelection
	): Promise<void> {
		const pinned = this.plugin.chatSessionService.getPinned();
		const candidates =
			this.plugin.markdownIndexService?.search(message, 5) || [];

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

		try {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) {
				new Notice("File not found");
				return;
			}

			const editSystem: ModelMessage = {
				role: "system",
				content: `You are editing the file: ${path}

CRITICAL WORKFLOW:
1. First use read_doc to get the current content
2. Then use propose_edit with the complete updated content based on the user's request
3. NEVER output file content directly - ALWAYS use the propose_edit tool
4. After using propose_edit, provide only a brief summary of what you changed

${
	providerSelection.modelId?.toLowerCase().includes("mistral")
		? `
MISTRAL-SPECIFIC ENFORCEMENT:
- ALWAYS use <think> tags when formulating your response or reasoning through problems
- Put ALL your reasoning, planning, and thought process inside <think></think> tags
- Close your thinking with </think> before taking any actions or giving final answers
- DO NOT think out loud as your final answer - use the thinking tags properly
- You can use multiple tools during the process as needed (search, read, edit, create, etc.)
- You do NOT need user confirmation to make edits - proceed directly with propose_edit or create_doc
- After thinking, immediately execute the required tools (propose_edit, create_doc, etc.)
- Your final response should only be a brief summary after tool execution
`
		: ""
}

Generate the full updated markdown content incorporating the requested changes while maintaining the existing structure and style unless specifically asked to change it.`,
			};

			const fileContext: ModelMessage = {
				role: "user",
				content: `Please edit the file: ${path}

Apply the changes I requested while keeping the existing structure and style intact unless specifically asked to modify them.`,
			};

			const streamingMessage = this.messageRenderer.createStreamingMessage(
				this.messagesEl
			);
			streamingMessage.setThinking(true);
			streamingMessage.updateContent("Reading file and generating changes...");

			const result = await this.plugin.aiService!.streamChat(
				[editSystem, ...session.messages, fileContext],
				"write",
				(delta) => {
					streamingMessage.appendContent(delta);
					streamingMessage.setThinking(false);
				},
				(status) => {
					if (
						(streamingMessage.contentEl.textContent || "") === "" ||
						streamingMessage.contentEl.hasClass("thinking")
					) {
						streamingMessage.updateContent(status);
						streamingMessage.setThinking(true);
					}
				},
				(thoughts) => {
					streamingMessage.addThinkingSection(thoughts);
				},
				providerSelection.provider,
				providerSelection.modelId
			);

			const finalText =
				streamingMessage.contentEl.textContent || result.text || "";
			session.messages.push({ role: "assistant", content: finalText });
			await streamingMessage.finalize();

			await this.handleProposalsAndCreations(result);
			await this.handleProposalsAndCreations(result);
		} catch (error) {
			console.error("[ChatbotView] Write mode error:", error);
			new Notice(
				`Error editing file: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	private async handleProposalsAndCreations(result: any): Promise<void> {
		if (result.proposals?.length) {
			console.log("[ChatbotView] Found proposals:", result.proposals);
			for (const proposal of result.proposals) {
				if (proposal.path && proposal.content) {
					const file = this.app.vault.getAbstractFileByPath(proposal.path);
					const originalContent =
						file instanceof TFile ? await this.app.vault.read(file) : "";

					const modal = new DiffModal(
						this.app,
						proposal.path,
						originalContent,
						proposal.content,
						async (confirmed: boolean, editedContent?: string) => {
							if (confirmed) {
								try {
									const contentToApply = editedContent || proposal.content;

									if (file instanceof TFile) {
										await this.app.vault.modify(file, contentToApply);
									} else {
										const folderPath = proposal.path
											.split("/")
											.slice(0, -1)
											.join("/");
										if (folderPath) {
											try {
												await this.app.vault.createFolder(folderPath);
											} catch {}
										}
										await this.app.vault.create(proposal.path, contentToApply);
									}
									new Notice(`Successfully updated ${proposal.path}`);
								} catch (error) {
									new Notice(`Failed to update ${proposal.path}: ${error}`);
								}
							}
						}
					);
					modal.open();
				}
			}
		}

		if (result.creations?.length) {
			console.log("[ChatbotView] Found creations:", result.creations);
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
