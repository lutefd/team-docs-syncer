import { Component, MarkdownRenderer, TFile } from "obsidian";
import type { ModelMessage } from "ai";
import TeamDocsPlugin from "../../../main";
import { LinkHandler } from "./LinkHandler";

export interface MessageRenderOptions {
	onOpenFile?: (path: string) => void;
	onFixInternalLinks?: (container: HTMLElement) => void;
}

/**
 * Component responsible for rendering chat messages with markdown support
 */
export class MessageRenderer extends Component {
	private linkHandler: LinkHandler;

	constructor(
		private plugin: TeamDocsPlugin,
		private options: MessageRenderOptions = {}
	) {
		super();
		this.linkHandler = new LinkHandler(plugin, {
			onOpenFile: options.onOpenFile,
		});
	}

	/**
	 * Render all messages in a session
	 */
	async renderMessages(
		messagesEl: HTMLElement,
		messages: ModelMessage[]
	): Promise<void> {
		messagesEl.empty();

		for (const message of messages) {
			await this.renderMessage(messagesEl, message);
		}

		messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	/**
	 * Render a single message
	 */
	async renderMessage(
		container: HTMLElement,
		message: ModelMessage
	): Promise<HTMLElement> {
		const row = container.createDiv({ cls: `msg msg-${message.role}` });

		const authorText = message.role === "user" ? "You" : "Assistant";
		row.createEl("div", { text: authorText, cls: "msg-author" });

		const contentEl = row.createEl("div", { cls: "msg-content" });

		try {
			let contentText =
				typeof message.content === "string"
					? message.content
					: JSON.stringify(message.content);

			contentText = contentText.replace(
				/<attachedcontent[^>]*>[\s\S]*?<\/attachedcontent>/g,
				""
			);

			await MarkdownRenderer.render(
				this.plugin.app,
				contentText,
				contentEl,
				this.plugin.app.workspace.getActiveFile()?.path || "/",
				this
			);

			this.linkHandler.fixInternalLinks(contentEl);

			if (this.options.onFixInternalLinks) {
				this.options.onFixInternalLinks(contentEl);
			}
		} catch (e) {
			console.warn(
				"[MessageRenderer] Markdown render failed; falling back to text",
				e
			);
			let contentText =
				typeof message.content === "string"
					? message.content
					: JSON.stringify(message.content);

			contentText = contentText.replace(
				/<attachedcontent>[\s\S]*?<\/attachedcontent>/g,
				""
			);
			contentEl.textContent = contentText;

			this.linkHandler.fixInternalLinks(contentEl);
		}

		return row;
	}

	/**
	 * Create a streaming message that can be updated in real-time
	 */
	createStreamingMessage(
		container: HTMLElement,
		role: "user" | "assistant" = "assistant"
	): {
		element: HTMLElement;
		contentEl: HTMLElement;
		updateContent: (text: string) => void;
		appendContent: (delta: string) => void;
		setThinking: (thinking: boolean) => void;
		addThinkingSection: (thoughts: string) => void;
		setPlaceholder: (placeholder: string) => void;
		finalize: () => Promise<void>;
	} {
		const row = container.createDiv({ cls: `msg msg-${role}` });
		const authorText = role === "user" ? "You" : "Assistant";
		row.createEl("div", { text: authorText, cls: "msg-author" });

		let thinkingSection: HTMLElement | null = null;
		let thinkingContent = "";

		const contentEl = row.createEl("div", { cls: "msg-content" });

		let currentContent = "";
		let finalAnswerContent = "";
		let isPlaceholder = false;
		let renderTimeout: NodeJS.Timeout | null = null;
		const RENDER_DEBOUNCE_MS = 25;
		let insideThinking = false;
		let currentThinkingBuffer = "";

		const renderMarkdownDebounced = async (content: string) => {
			if (renderTimeout) {
				clearTimeout(renderTimeout);
			}

			renderTimeout = setTimeout(async () => {
				if (!content.trim()) return;

				const cleanContent = content.replace(
					/<attachedcontent[^>]*>[\s\S]*?<\/attachedcontent>/g,
					""
				);

				try {
					contentEl.empty();
					await MarkdownRenderer.render(
						this.plugin.app,
						cleanContent,
						contentEl,
						this.plugin.app.workspace.getActiveFile()?.path || "/",
						this
					);

					const attachedContentElements =
						contentEl.querySelectorAll("attachedcontent");
					attachedContentElements.forEach((el) => el.remove());

					this.linkHandler.fixInternalLinks(contentEl);
					if (this.options.onFixInternalLinks) {
						this.options.onFixInternalLinks(contentEl);
					}
				} catch (e) {
					contentEl.textContent = cleanContent;
					this.linkHandler.fixInternalLinks(contentEl);
				}

				container.scrollTop = container.scrollHeight;
			}, RENDER_DEBOUNCE_MS);
		};

		const updateContent = (text: string) => {
			currentContent = text;
			finalAnswerContent = text
				.replace(/<think>[\s\S]*?<\/think>/g, "")
				.replace(/<finalAnswer>/g, "")
				.replace(/<\/finalAnswer>/g, "");
			isPlaceholder = false;
			contentEl.removeClass("placeholder");

			if (finalAnswerContent.trim()) {
				renderMarkdownDebounced(finalAnswerContent);
			} else {
				contentEl.textContent = finalAnswerContent;
			}
			container.scrollTop = container.scrollHeight;
		};

		const appendContent = (delta: string) => {
			if (delta) {
				if (isPlaceholder) {
					currentContent = delta;
					finalAnswerContent = "";
					isPlaceholder = false;
					contentEl.removeClass("placeholder");
				} else {
					currentContent += delta;
				}

				let i = 0;
				while (i < delta.length) {
					const char = delta[i];

					if (!insideThinking && delta.substring(i).startsWith("<think>")) {
						insideThinking = true;
						currentThinkingBuffer = "";
						i += 7;
						continue;
					}

					if (insideThinking && delta.substring(i).startsWith("</think>")) {
						insideThinking = false;
						if (currentThinkingBuffer.trim()) {
							addThinkingSection(currentThinkingBuffer);
						}
						currentThinkingBuffer = "";
						i += 8;
						continue;
					}

					if (delta.substring(i).startsWith("<finalAnswer>")) {
						i += 13;
						continue;
					}
					if (delta.substring(i).startsWith("</finalAnswer>")) {
						i += 14;
						continue;
					}

					if (insideThinking) {
						currentThinkingBuffer += char;
					} else {
						finalAnswerContent += char;
					}

					i++;
				}

				if (finalAnswerContent.trim()) {
					renderMarkdownDebounced(finalAnswerContent);
				} else if (!isPlaceholder && !finalAnswerContent) {
					contentEl.textContent = "💭 Processando...";
					contentEl.addClass("placeholder");
				}

				container.scrollTop = container.scrollHeight;
			}
		};

		const setThinking = (thinking: boolean) => {
			if (thinking) {
				contentEl.addClass("thinking");
			} else {
				contentEl.removeClass("thinking");
			}
		};

		const setPlaceholder = (placeholder: string) => {
			if (placeholder) {
				isPlaceholder = true;
				contentEl.textContent = placeholder;
				contentEl.addClass("placeholder");
			} else {
				isPlaceholder = false;
				contentEl.removeClass("placeholder");
				if (!currentContent) {
					contentEl.textContent = "";
				}
			}
			container.scrollTop = container.scrollHeight;
		};

		const addThinkingSection = (thoughts: string) => {
			const cleanThoughts = thoughts
				.replace(/<think>/g, "")
				.replace(/<\/think>/g, "");

			thinkingContent += cleanThoughts;

			if (!thinkingSection) {
				thinkingSection = row.createDiv({ cls: "thinking-section" });

				const header = thinkingSection.createDiv({ cls: "thinking-header" });
				header.createSpan({ text: "💡", cls: "thinking-icon" });
				header.createSpan({ text: "Thinking process", cls: "thinking-title" });
				const toggle = header.createSpan({ text: "▼", cls: "thinking-toggle" });

				const thinkingContentEl = thinkingSection.createDiv({
					cls: "thinking-content",
				});

				header.addEventListener("click", () => {
					const isCollapsed = thinkingContentEl.hasClass("collapsed");
					if (isCollapsed) {
						thinkingContentEl.removeClass("collapsed");
						toggle.textContent = "▼";
					} else {
						thinkingContentEl.addClass("collapsed");
						toggle.textContent = "▲";
					}
				});

				row.insertBefore(thinkingSection, contentEl);
			}

			const thinkingContentEl = thinkingSection.querySelector(
				".thinking-content"
			) as HTMLElement;
			if (thinkingContentEl) {
				thinkingContentEl.textContent = thinkingContent;
				thinkingContentEl.scrollTop = thinkingContentEl.scrollHeight;
			}
		};

		const finalize = async () => {
			if (renderTimeout) {
				clearTimeout(renderTimeout);
				renderTimeout = null;
			}

			contentEl.removeClass("thinking");
			contentEl.removeClass("placeholder");
			isPlaceholder = false;

			if (currentContent) {
				let processedContent =
					finalAnswerContent && finalAnswerContent.trim()
						? finalAnswerContent
						: currentContent;

				const thinkMatches = processedContent.match(
					/<think>[\s\S]*?<\/think>/g
				);

				if (thinkMatches) {
					for (const match of thinkMatches) {
						const thinkContent = match.replace(/<\/?think>/g, "");
						if (thinkContent.trim()) {
							addThinkingSection(thinkContent);
						}
					}
					processedContent = processedContent.replace(
						/<think>[\s\S]*?<\/think>/g,
						""
					);
				}

				processedContent = processedContent.replace(/<\/?finalAnswer>/g, "");

				processedContent = processedContent.replace(
					/<attachedcontent[^>]*>[\s\S]*?<\/attachedcontent>/g,
					""
				);

				try {
					contentEl.empty();
					await MarkdownRenderer.render(
						this.plugin.app,
						processedContent,
						contentEl,
						this.plugin.app.workspace.getActiveFile()?.path || "/",
						this
					);

					const attachedContentElements =
						contentEl.querySelectorAll("attachedcontent");
					attachedContentElements.forEach((el) => el.remove());

					this.linkHandler.fixInternalLinks(contentEl);

					if (this.options.onFixInternalLinks) {
						this.options.onFixInternalLinks(contentEl);
					}
				} catch (e) {
					console.warn(
						"[MessageRenderer] Markdown render failed; falling back to text",
						e
					);
					let cleanContent = processedContent.replace(
						/<attachedcontent[^>]*>[\s\S]*?<\/attachedcontent>/g,
						""
					);
					contentEl.textContent = cleanContent;
					this.linkHandler.fixInternalLinks(contentEl);
				}
			}
		};

		return {
			element: row,
			contentEl,
			updateContent,
			appendContent,
			setThinking,
			addThinkingSection,
			setPlaceholder,
			finalize,
		};
	}
}
