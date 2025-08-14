import {
	ItemView,
	WorkspaceLeaf,
	TFile,
	Notice,
	MarkdownRenderer,
} from "obsidian";
import TeamDocsPlugin from "../../main";
import type { ModelMessage } from "ai";
import { ChatSessionsModal } from "./ChatSessionsModal";
import { DiffModal } from "./DiffModal";
import { EditTargetModal } from "./EditTargetModal";

export const CHATBOT_VIEW = "team-docs-chatbot";

type Mode = "chat" | "write";

export class ChatbotView extends ItemView {
	private plugin: TeamDocsPlugin;
	private mode: Mode = "chat";
	private container!: HTMLElement;
	private sourcesEl!: HTMLElement;
	private messagesEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;
	private pinsEl!: HTMLElement;
	private mentionMenuEl?: HTMLElement;
	private mentionActive = false;
	private mentionItems: string[] = [];
	private mentionIndex = 0;

	constructor(leaf: WorkspaceLeaf, plugin: TeamDocsPlugin) {
		super(leaf);
		this.plugin = plugin;
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

		const container = (this.container = this.containerEl
			.children[1] as HTMLElement);
		container.empty();
		container.addClass("team-chatbot-view");

		const header = container.createDiv({ cls: "chatbot-header" });

		const modeWrap = header.createDiv({ cls: "chatbot-mode" });
		const chatBtn = modeWrap.createEl("button", {
			text: "Chat",
			cls: "chatbot-btn",
		});
		const writeBtn = modeWrap.createEl("button", {
			text: "Write",
			cls: "chatbot-btn",
		});

		const sessionsBtn = header.createEl("button", {
			text: "Sessions",
			cls: "chatbot-btn",
		});
		sessionsBtn.onclick = () => {
			new ChatSessionsModal(this.app, this.plugin, () =>
				this.renderMessages()
			).open();
		};

		const setMode = (m: Mode) => {
			this.mode = m;
			chatBtn.toggleClass("is-active", m === "chat");
			writeBtn.toggleClass("is-active", m === "write");
			this.renderSystemNotice();
		};
		chatBtn.onclick = () => setMode("chat");
		writeBtn.onclick = () => setMode("write");
		setMode("chat");

		this.pinsEl = container.createDiv({ cls: "chatbot-pins" });
		this.renderPins();

		this.sourcesEl = container.createDiv({ cls: "chatbot-sources" });

		this.messagesEl = container.createDiv({ cls: "chatbot-messages" });
		this.renderMessages();

		const composer = container.createDiv({ cls: "chatbot-composer" });
		this.inputEl = composer.createEl("textarea", {
			cls: "chatbot-input",
			attr: { rows: "3", placeholder: "Ask about your team docs..." },
		});
		this.sendBtn = composer.createEl("button", {
			text: "Send",
			cls: "chatbot-send",
		});
		this.sendBtn.onclick = () => this.handleSend();

		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				this.handleSend();
			}
			if (this.mentionActive) {
				if (e.key === "ArrowDown") {
					e.preventDefault();
					this.mentionIndex = Math.min(
						this.mentionIndex + 1,
						this.mentionItems.length - 1
					);
					this.renderMentionMenu();
				} else if (e.key === "ArrowUp") {
					e.preventDefault();
					this.mentionIndex = Math.max(this.mentionIndex - 1, 0);
					this.renderMentionMenu();
				} else if (e.key === "Enter") {
					e.preventDefault();
					this.applyMentionSelection();
				} else if (e.key === "Escape") {
					this.hideMentionMenu();
				}
			}
		});

		this.inputEl.addEventListener("input", () => this.onComposerInput());
	}

	async onClose(): Promise<void> {}

	private renderPins() {
		if (!this.pinsEl) return;
		this.pinsEl.empty();
		const session = this.plugin.chatSessionService.getActive();
		const pins = session ? Array.from(session.pinnedPaths) : [];
		for (const p of pins) {
			const chip = this.pinsEl.createDiv({ cls: "pin-chip" });
			chip.createSpan({ text: p, cls: "pin-label" });
			const x = chip.createEl("button", { text: "×", cls: "pin-remove" });
			x.onclick = () => {
				this.plugin.chatSessionService.unpin(p);
				this.renderPins();
			};
		}
	}

	private onComposerInput() {
		console.log("[Chatbot] onComposerInput called");
		const val = this.inputEl.value;
		console.log("[Chatbot] Input value:", val);
		const at = this.findActiveMention(
			val,
			this.inputEl.selectionStart || val.length
		);
		console.log("[Chatbot] Found mention:", at);
		if (!at) {
			this.hideMentionMenu();
			return;
		}
		const q = at.token.slice(1);
		console.log("[Chatbot] Search query:", q);
		const searchResults = this.plugin.markdownIndexService?.search(q, 8) || [];
		const uniquePaths = new Set<string>();
		const results = searchResults
			.filter((r) => {
				if (uniquePaths.has(r.path)) return false;
				uniquePaths.add(r.path);
				return true;
			})
			.map((r) => r.path);
		console.log("[Chatbot] Search results:", results);
		this.mentionItems = results;
		this.mentionIndex = 0;
		if (results.length > 0) this.showMentionMenu(results);
		else this.hideMentionMenu();
	}

	private findActiveMention(
		text: string,
		caret: number
	): { start: number; end: number; token: string } | null {
		const left = text.slice(0, caret);
		const m = left.match(/@[^\s@]*$/);
		if (!m) return null;
		const start = left.lastIndexOf("@");
		const end = caret;
		const token = text.slice(start, end);
		return { start, end, token };
	}

	private showMentionMenu(items: string[]) {
		console.log("[Chatbot] showMentionMenu called with:", items);
		if (!this.mentionMenuEl) {
			const composer = this.container.querySelector(
				".chatbot-composer"
			) as HTMLElement;
			this.mentionMenuEl =
				composer?.createDiv({ cls: "mention-menu" }) ||
				this.container.createDiv({ cls: "mention-menu" });
		}
		this.mentionActive = true;
		this.renderMentionMenu();
	}

	private renderMentionMenu() {
		console.log("[Chatbot] renderMentionMenu called");
		if (!this.mentionMenuEl) return;
		this.mentionMenuEl.empty();
		this.mentionMenuEl.addClass("open");
		this.mentionMenuEl.style.display = "block";
		for (let i = 0; i < this.mentionItems.length; i++) {
			const p = this.mentionItems[i];
			const item = this.mentionMenuEl.createDiv({ cls: "mention-item" });
			if (i === this.mentionIndex) item.addClass("active");
			item.setText(p);
			item.onclick = () => {
				this.mentionIndex = i;
				this.applyMentionSelection();
			};
		}
		this.mentionMenuEl.style.position = "absolute";
		this.mentionMenuEl.style.bottom = "100%";
		this.mentionMenuEl.style.left = "0";
		this.mentionMenuEl.style.right = "0";
		this.mentionMenuEl.style.marginBottom = "4px";
	}

	private hideMentionMenu() {
		console.log("[Chatbot] hideMentionMenu called");
		this.mentionActive = false;
		if (this.mentionMenuEl) {
			this.mentionMenuEl.style.display = "none";
			this.mentionMenuEl.removeClass("open");
		}
	}

	private applyMentionSelection() {
		if (!this.mentionActive || this.mentionItems.length === 0) return;
		const val = this.inputEl.value;
		const caret = this.inputEl.selectionStart || val.length;
		const at = this.findActiveMention(val, caret);
		if (!at) return;
		const picked = this.mentionItems[this.mentionIndex];
		const before = val.slice(0, at.start);
		const after = val.slice(at.end);

		const filename = picked.split("/").pop() || picked;
		const inserted = `[[${picked}|${filename}]] `;

		this.inputEl.value = before + inserted + after;
		const newCaret = (before + inserted).length;
		this.inputEl.setSelectionRange(newCaret, newCaret);
		this.hideMentionMenu();
		this.plugin.chatSessionService.pin(picked);
		this.renderPins();
	}

	private renderSystemNotice(host?: HTMLElement) {
		const container = host || this.container;
		let notice = container.querySelector(
			".chatbot-notice"
		) as HTMLElement | null;
		if (!notice) {
			notice = container.createDiv({ cls: "chatbot-notice" });
		}
		notice.empty();

		if (!this.plugin.aiService?.hasApiKey()) {
			notice.createEl("div", {
				text: "OpenAI API key missing. Set it in Settings → AI (OpenAI) to enable the chatbot.",
				cls: "warning",
			});
			this.sendBtn?.setAttribute("disabled", "true");
		} else {
			notice.createEl("div", {
				text:
					this.mode === "chat"
						? "Chat mode: The assistant will answer questions about your Team Docs and cite relevant files."
						: "Write mode: The assistant can propose edits to files within your Team Docs. You'll review and apply changes.",
			});
			this.sendBtn?.removeAttribute("disabled");
		}
	}

	private renderMessageElement(msg: ModelMessage) {
		if (!this.messagesEl) return;
		const row = this.messagesEl.createDiv({ cls: `msg msg-${msg.role}` });
		row.createEl("div", {
			text:
				msg.role === "user"
					? "You"
					: msg.role === "assistant"
					? "Assistant"
					: "System",
			cls: "msg-author",
		});
		const contentStr =
			typeof msg.content === "string"
				? msg.content
				: Array.isArray(msg.content)
				? (msg.content as any[])
						.map((p) =>
							typeof p === "string" ? p : (p && (p as any).text) || ""
						)
						.join("")
				: "";
		const contentEl = row.createDiv({ cls: "msg-content" });
		if (msg.role === "assistant") {
			MarkdownRenderer.render(
				this.app,
				contentStr,
				contentEl,
				this.app.workspace.getActiveFile()?.path || "/",
				this
			);
		} else {
			contentEl.textContent = contentStr;
		}
		this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
	}

	private appendMessage(msg: ModelMessage) {
		const session = this.plugin.chatSessionService.getActive();
		if (!session) return;
		session.messages.push(msg);
		this.renderMessageElement(msg);
	}

	private async handleSend() {
		const query = this.inputEl.value.trim();
		if (!query) return;
		if (!this.plugin.aiService?.hasApiKey()) {
			new Notice("OpenAI API key is missing in settings.");
			return;
		}
		const session = this.plugin.chatSessionService.getActive();
		if (!session) return;

		if (session.messages.length === 0) {
			this.plugin.chatSessionService.rename(
				session.id,
				query.length > 50 ? query.slice(0, 50) + "…" : query
			);
			console.log(
				"[Chatbot] Session renamed to:",
				this.plugin.chatSessionService.getActive()?.title
			);
		}

		this.appendMessage({ role: "user", content: query });
		this.inputEl.value = "";

		const pinned = this.plugin.chatSessionService.getPinned();
		const candidates = this.plugin.markdownIndexService?.search(query, 5) || [];

		const system: ModelMessage = {
			role: "system",
			content:
				this.mode === "chat"
					? `You are a helpful assistant for a software team. CRITICAL: You MUST use search_docs tool for every question to read actual file content before answering. Never guess or assume file contents. ${
							pinned.length > 0
								? "The user has pinned specific files - search these first, but also search for additional relevant files."
								: "Use search_docs to find all relevant files."
					  } If search_docs snippets are insufficient, use read_doc to get full file content. IMPORTANT: After reading any document with read_doc, use the follow_links tool on that document's content to gather comprehensive context from linked documents (up to 5 documents deep) if the link is not found in the search_docs and it's relevant. Do not skip this step even if you think the document doesn't contain links. Always cite file paths using Obsidian format [[path/to/file.md|filename]]. Be concise but accurate.`
					: `You are a helpful assistant for editing team documents. CRITICAL: You MUST use search_docs tool to read actual file content before making any edits. Never guess file contents. ${
							pinned.length > 0
								? "Search pinned files first, then search for additional context if needed."
								: "Use search_docs to understand all relevant context."
					  } Use read_doc for full content when needed. IMPORTANT: After reading any document with read_doc, ALWAYS use the follow_links tool on that document's content to gather comprehensive context from linked documents. Do not skip this step even if you think the document doesn't contain links.

IMPORTANT: For edits, use propose_edit tool to specify which file to edit and what changes to make. For new files, use create_doc tool to specify the path and content. DO NOT output file content in your response - the tools handle the actual file operations. After using tools, only provide a brief summary of what was done and reference files using [[path/to/file.md|filename]] format for clickable links.`,
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
			content: `Relevant files (by title/frontmatter):\n\n${contextBlurb}\n\nPinned files:\n${pinned
				.map((p, i) => `#${i + 1} ${p}`)
				.join("\n")}`,
		};

		try {
			if (this.mode === "write") {
				const picked = await new Promise<string | null>((resolve) => {
					new EditTargetModal(
						this.app,
						this.plugin,
						candidates.map((c) => c.path),
						(p) => resolve(p)
					).open();
				});
				if (!picked) return;
				await this.generateEditWithStreamChat(picked, [
					system,
					assistantPrep,
					...session.messages,
				]);
				return;
			}

			const msgList = [
				system,
				assistantPrep,
				...session.messages,
			] as ModelMessage[];
			const row = this.messagesEl.createDiv({ cls: `msg msg-assistant` });
			row.createEl("div", { text: "Assistant", cls: "msg-author" });
			const contentEl = row.createEl("div", { cls: "msg-content" });
			let fullText = "";

			console.log("[Chatbot] streamChat start, mode=", this.mode);
			contentEl.textContent = "Thinking...";
			contentEl.addClass("thinking");
			const result = await this.plugin.aiService!.streamChat(
				msgList,
				this.mode,
				(delta) => {
					if (fullText === "" && contentEl.hasClass("thinking")) {
						contentEl.removeClass("thinking");
						contentEl.textContent = "";
					}
					fullText += delta;
					try {
						contentEl.textContent = fullText;
						this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
						if (fullText.length % 200 === 0)
							console.log("[Chatbot] streamed chars:", fullText.length);
					} catch (e) {
						console.warn("[Chatbot] Failed to render delta", e);
					}
				},
				(status) => {
					if (fullText === "" || contentEl.hasClass("thinking")) {
						contentEl.textContent = status;
						contentEl.addClass("thinking");
					}
				}
			);
			console.log("[Chatbot] streamChat done. text length=", fullText.length);

			if (fullText.length === 0 && result.text && result.text.length > 0) {
				fullText = result.text;
				contentEl.textContent = fullText;
			}

			contentEl.removeClass("thinking");

			session.messages.push({ role: "assistant", content: fullText });
			try {
				contentEl.empty();
				await MarkdownRenderer.render(
					this.app,
					fullText,
					contentEl,
					this.app.workspace.getActiveFile()?.path || "/",
					this
				);
				this.fixInternalLinks(contentEl);
			} catch (e) {
				console.warn(
					"[Chatbot] Markdown render failed; falling back to text",
					e
				);
				contentEl.textContent = fullText;
			}

			const finalSources = result.sources?.length ? result.sources : [];
			if (finalSources.length) this.renderSources(finalSources);

			if (result.proposals?.length) {
				console.log("[Chatbot] Found proposals:", result.proposals);
				await this.handleProposals(result.proposals);
			} else {
				console.log("[Chatbot] No proposals found in result");
			}

			if (result.creations?.length) {
				console.log("[Chatbot] Found creations:", result.creations);
				await this.handleCreations(result.creations);
			} else {
				console.log("[Chatbot] No creations found in result");
			}
		} catch (e: any) {
			new Notice(`Chat error: ${e?.message || e}`);
		}
	}

	private async generateEditWithStreamChat(
		path: string,
		messages: ModelMessage[]
	) {
		try {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) {
				new Notice("File not found");
				return;
			}

			const editSystem: ModelMessage = {
				role: "system",
				content: `You are editing the file: ${path}

First use read_doc to get the current content, then use propose_edit with the complete updated content based on the user's request. Generate the full updated markdown content incorporating the requested changes while maintaining the existing structure and style unless specifically asked to change it.`,
			};

			const fileContext: ModelMessage = {
				role: "user",
				content: `Please edit the file: ${path}

Apply the changes I requested while keeping the existing structure and style intact unless specifically asked to modify them.`,
			};

			const row = this.messagesEl.createDiv({ cls: `msg msg-assistant` });
			row.createEl("div", { text: "Assistant", cls: "msg-author" });
			const contentEl = row.createEl("div", { cls: "msg-content" });
			let fullText = "";

			console.log("[Chatbot] generateEditWithStreamChat for file:", path);
			contentEl.textContent = "Reading file and generating changes...";
			contentEl.addClass("thinking");

			const result = await this.plugin.aiService!.streamChat(
				[editSystem, ...messages, fileContext],
				"write",
				(delta) => {
					if (fullText === "" && contentEl.hasClass("thinking")) {
						contentEl.removeClass("thinking");
						contentEl.textContent = "";
					}
					fullText += delta;
					try {
						contentEl.textContent = fullText;
						this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
					} catch (e) {
						console.warn("[Chatbot] Failed to render delta", e);
					}
				},
				(status) => {
					if (fullText === "" || contentEl.hasClass("thinking")) {
						contentEl.textContent = status;
						contentEl.addClass("thinking");
					}
				}
			);

			if (fullText.length === 0 && result.text && result.text.length > 0) {
				fullText = result.text;
				contentEl.textContent = fullText;
			}

			contentEl.removeClass("thinking");

			const session = this.plugin.chatSessionService.getActive();
			if (session) {
				session.messages.push({ role: "assistant", content: fullText });
			}

			try {
				contentEl.empty();
				await MarkdownRenderer.render(
					this.app,
					fullText,
					contentEl,
					this.app.workspace.getActiveFile()?.path || "/",
					this
				);
				this.fixInternalLinks(contentEl);
			} catch (e) {
				console.warn(
					"[Chatbot] Markdown render failed; falling back to text",
					e
				);
				contentEl.textContent = fullText;
			}

			if (result.proposals?.length) {
				console.log(
					"[Chatbot] Found proposals for target file:",
					result.proposals
				);
				await this.handleProposals(result.proposals);
			} else {
				console.log(
					"[Chatbot] No proposals found - this shouldn't happen in write mode"
				);
			}

			if (result.creations?.length) {
				console.log("[Chatbot] Found creations:", result.creations);
				await this.handleCreations(result.creations);
			}
		} catch (e: any) {
			new Notice(`Generate & Apply error: ${e?.message || e}`);
		}
	}
	private async handleProposals(
		proposals: Array<{ path: string; content: string }>
	) {
		for (const proposal of proposals) {
			try {
				const file = this.app.vault.getAbstractFileByPath(proposal.path);
				let currentContent = "";

				if (file && file instanceof TFile) {
					currentContent = await this.app.vault.read(file);
				}

				console.log("[ChatbotView] Creating diff modal with:");
				console.log("- Current content length:", currentContent.length);
				console.log("- Proposed content length:", proposal.content.length);
				console.log(
					"- Proposed content preview:",
					proposal.content.substring(0, 200)
				);

				const modal = new DiffModal(
					this.app,
					proposal.path,
					currentContent,
					proposal.content,
					async (confirmed: boolean) => {
						if (confirmed) {
							try {
								if (file && file instanceof TFile) {
									await this.app.vault.modify(file, proposal.content);
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
									await this.app.vault.create(proposal.path, proposal.content);
								}
								new Notice(`Successfully updated ${proposal.path}`);
							} catch (error) {
								new Notice(`Failed to update ${proposal.path}: ${error}`);
							}
						}
					}
				);
				modal.open();
			} catch (error) {
				console.error("Error handling proposal:", error);
				new Notice(`Error processing proposal for ${proposal.path}`);
			}
		}
	}

	private async handleCreations(
		creations: Array<{ path: string; content: string }>
	) {
		for (const creation of creations) {
			try {
				const file = this.app.vault.getAbstractFileByPath(creation.path);
				if (file && file instanceof TFile) {
					const currentContent = await this.app.vault.read(file);
					const modal = new DiffModal(
						this.app,
						creation.path,
						currentContent,
						creation.content,
						async (confirmed: boolean) => {
							if (confirmed) {
								try {
									await this.app.vault.modify(file, creation.content);
									new Notice(`Successfully updated ${creation.path}`);
								} catch (error) {
									new Notice(`Failed to update ${creation.path}: ${error}`);
								}
							}
						}
					);
					modal.open();
				} else {
					const folderPath = creation.path.split("/").slice(0, -1).join("/");
					if (folderPath) {
						try {
							await this.app.vault.createFolder(folderPath);
						} catch {}
					}
					await this.app.vault.create(creation.path, creation.content);
					new Notice(`Successfully created ${creation.path}`);
					await this.openFile(creation.path);
				}
			} catch (error) {
				console.error("Error handling creation:", error);
				new Notice(`Error creating file ${creation.path}: ${error}`);
			}
		}
	}

	private renderMessages() {
		if (!this.messagesEl) return;
		this.messagesEl.empty();
		const session = this.plugin.chatSessionService.getActive();
		if (!session) return;
		for (const m of session.messages) {
			this.renderMessageElement(m);
		}
	}

	private renderSources(paths: string[]) {
		this.sourcesEl.empty();
		const title = this.sourcesEl.createEl("div", {
			text: "Sources",
			cls: "sources-title",
		});

		const uniquePaths = Array.from(new Set(paths.filter((p) => p)));

		if (uniquePaths.length === 0) {
			this.sourcesEl.createEl("div", { text: "No relevant files found." });
			return;
		}

		console.log("[Chatbot] Displaying sources:", uniquePaths);

		const list = this.sourcesEl.createEl("ul", { cls: "sources-list" });
		for (const p of uniquePaths) {
			const li = list.createEl("li");
			const filename = p.split("/").pop() || p;
			const a = li.createEl("a", { text: filename, cls: "internal-link" });
			a.dataset.href = p;
			a.onclick = (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.openFile(p);
			};
		}
	}

	private async openFile(filePath: string): Promise<void> {
		console.log("[Chatbot] Opening file:", filePath);
		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file) {
				await this.app.workspace.openLinkText(filePath, "", false);
				console.log("[Chatbot] File opened successfully");
			} else {
				console.warn("[Chatbot] File not found:", filePath);
				new Notice(`File not found: ${filePath}`);
			}
		} catch (error) {
			console.error("[Chatbot] Error opening file:", error);
			new Notice(`Error opening file: ${filePath}`);
		}
	}

	private fixInternalLinks(container: HTMLElement) {
		const links = container.querySelectorAll("a.internal-link, a.wiki-link");
		links.forEach((link) => {
			const href = link.getAttribute("data-href") || link.getAttribute("href");
			if (href) {
				link.removeAttribute("href");

				(link as HTMLElement).onclick = (e) => {
					e.preventDefault();
					e.stopPropagation();
					console.log("[Chatbot] Link clicked:", href);
					this.openFile(href);
				};

				link.addClass("internal-link");
				link.addClass("is-unresolved");

				const linkText = link.textContent || "";
				if (!linkText.includes("|") && !linkText.includes(" ")) {
					const filename = href.split("/").pop() || href;
					if (linkText !== filename) {
						link.textContent = filename;
					}
				}
			}
		});

		const wikiLinkRegex = /\[\[(.*?)(?:\|(.*?))?\]\]/g;
		const textNodes = this.getTextNodes(container);

		textNodes.forEach((node) => {
			if (!node.textContent) return;

			const text = node.textContent;
			if (!wikiLinkRegex.test(text)) return;

			wikiLinkRegex.lastIndex = 0;

			let lastIndex = 0;
			let match;
			const fragment = document.createDocumentFragment();

			while ((match = wikiLinkRegex.exec(text)) !== null) {
				if (match.index > lastIndex) {
					fragment.appendChild(
						document.createTextNode(text.substring(lastIndex, match.index))
					);
				}

				const path = match[1];
				const displayName = match[2] || path.split("/").pop() || path;

				const link = document.createElement("a");
				link.textContent = displayName;
				link.classList.add("internal-link");
				link.classList.add("is-unresolved");
				link.dataset.href = path;

				link.onclick = (e) => {
					e.preventDefault();
					e.stopPropagation();
					this.openFile(path);
				};

				fragment.appendChild(link);
				lastIndex = wikiLinkRegex.lastIndex;
			}

			if (lastIndex < text.length) {
				fragment.appendChild(
					document.createTextNode(text.substring(lastIndex))
				);
			}

			if (lastIndex > 0 && node.parentNode) {
				node.parentNode.replaceChild(fragment, node);
			}
		});
	}

	private getTextNodes(node: Node): Text[] {
		const textNodes: Text[] = [];
		const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);

		let currentNode;
		while ((currentNode = walker.nextNode())) {
			textNodes.push(currentNode as Text);
		}

		return textNodes;
	}
}
