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
			const contentText =
				typeof message.content === "string"
					? message.content
					: JSON.stringify(message.content);

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
			const contentText =
				typeof message.content === "string"
					? message.content
					: JSON.stringify(message.content);
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
		finalize: () => Promise<void>;
	} {
		const row = container.createDiv({ cls: `msg msg-${role}` });
		const authorText = role === "user" ? "You" : "Assistant";
		row.createEl("div", { text: authorText, cls: "msg-author" });
		const contentEl = row.createEl("div", { cls: "msg-content" });

		let currentContent = "";

		const updateContent = (text: string) => {
			currentContent = text;
			contentEl.textContent = text;
			container.scrollTop = container.scrollHeight;
		};

		const appendContent = (delta: string) => {
			currentContent += delta;
			contentEl.textContent = currentContent;
			container.scrollTop = container.scrollHeight;
		};

		const setThinking = (thinking: boolean) => {
			if (thinking) {
				contentEl.addClass("thinking");
			} else {
				contentEl.removeClass("thinking");
			}
		};

		const finalize = async () => {
			contentEl.removeClass("thinking");

			if (currentContent) {
				try {
					contentEl.empty();
					await MarkdownRenderer.render(
						this.plugin.app,
						currentContent,
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
					contentEl.textContent = currentContent;
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
			finalize,
		};
	}
}
