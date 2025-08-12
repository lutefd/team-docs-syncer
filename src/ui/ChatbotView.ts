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
		header.createEl("h3", { text: "Team Docs Chatbot" });

		const sessionsBtn = header.createEl("button", { text: "Sessions" });
		sessionsBtn.onclick = () => {
			console.log("[Chatbot] Open sessions modal");
			new ChatSessionsModal(this.app, this.plugin, () =>
				this.renderMessages()
			).open();
		};

		const modeWrap = header.createDiv({ cls: "chatbot-mode" });
		const chatBtn = modeWrap.createEl("button", { text: "Chat" });
		const writeBtn = modeWrap.createEl("button", { text: "Write" });
		const setMode = (m: Mode) => {
			this.mode = m;
			chatBtn.toggleClass("is-active", m === "chat");
			writeBtn.toggleClass("is-active", m === "write");
			this.renderSystemNotice();
		};
		chatBtn.onclick = () => setMode("chat");
		writeBtn.onclick = () => setMode("write");
		setMode("chat");

		this.renderSystemNotice(header);

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
		});
	}

	async onClose(): Promise<void> {}

	private async reviewAndApplyProposal(path: string, content: string) {
		try {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) {
				new Notice("File not found for proposal");
				return;
			}
			if (!path.startsWith(this.plugin.settings.teamDocsPath + "/")) {
				new Notice("Edit blocked: outside team docs folder.");
				return;
			}

			const original = await this.app.vault.read(file);
			const confirmed = await new Promise<boolean>((resolve) => {
				new DiffModal(this.app, file.path, original, content, (ok) =>
					resolve(ok)
				).open();
			});
			if (!confirmed) {
				new Notice("Apply cancelled.");
				return;
			}

			const reserved = await this.plugin.reservationManager.reserveFile(file);
			if (!reserved) {
				new Notice("Could not reserve file; edit aborted.");
				return;
			}
			await this.app.vault.modify(file, content);
			new Notice("Proposal applied.");
		} catch (e: any) {
			new Notice(`Apply proposal error: ${e?.message || e}`);
		}
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

		const candidates = this.plugin.markdownIndexService?.search(query, 5) || [];
		this.renderSources(candidates.map((c) => c.path));

		const system: ModelMessage = {
			role: "system",
			content:
				this.mode === "chat"
					? `You are a helpful assistant for Obsidian Team Docs. Only discuss files within the team sync folder (${this.plugin.settings.teamDocsPath}). Use the provided file list as references. If unsure, say so. Keep answers concise and cite files by path.`
					: `You assist with editing Markdown files in the team sync folder (${this.plugin.settings.teamDocsPath}). Propose minimal, safe changes. Never create, edit, or reference files outside this folder. When suggesting an edit, output a short rationale followed by a full updated Markdown for a single chosen file.`,
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
			content: `Relevant files (by title/frontmatter):\n\n${contextBlurb}`,
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
				await this.generateAndApplyEdit(picked);
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
			const result = await this.plugin.aiService!.streamChat(
				msgList,
				this.mode,
				(delta) => {
					fullText += delta;
					try {
						contentEl.textContent = fullText;
						this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
						if (fullText.length % 200 === 0)
							console.log("[Chatbot] streamed chars:", fullText.length);
					} catch (e) {
						console.warn("[Chatbot] Failed to render delta", e);
					}
				}
			);
			console.log("[Chatbot] streamChat done. text length=", fullText.length);

			if (fullText.length === 0 && result.text && result.text.length > 0) {
				fullText = result.text;
				contentEl.textContent = fullText;
			}

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
			} catch (e) {
				console.warn(
					"[Chatbot] Markdown render failed; falling back to text",
					e
				);
				contentEl.textContent = fullText;
			}
			if (result.sources?.length) this.renderSources(result.sources);
		} catch (e: any) {
			new Notice(`Chat error: ${e?.message || e}`);
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
		if (paths.length === 0) {
			this.sourcesEl.createEl("div", { text: "No relevant files found." });
			return;
		}
		const list = this.sourcesEl.createEl("ul", { cls: "sources-list" });
		for (const p of paths) {
			const li = list.createEl("li");
			const a = li.createEl("a", { text: p, cls: "internal-link" });
			a.onclick = () => this.openFile(p);
		}
	}

	private async generateAndApplyEdit(path: string) {
		try {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) {
				new Notice("File not found");
				return;
			}
			if (!path.startsWith(this.plugin.settings.teamDocsPath + "/")) {
				new Notice("Edit blocked: outside team docs folder.");
				return;
			}
			const content = await this.app.vault.read(file);

			const sys: ModelMessage = {
				role: "system",
				content: `Produce a revised full Markdown for the selected file. Keep structure intact; only improve per the last user request. Output ONLY the Markdown content, no code fences.`,
			};
			const user: ModelMessage = {
				role: "user",
				content: `Original content of ${path}:\n\n${content}\n\nRevise per our discussion.`,
			};

			const session = this.plugin.chatSessionService.getActive();
			if (!session) return;
			const res = await this.plugin.aiService!.chat(
				[sys, ...session.messages, user],
				"write"
			);
			const revised = res.text;

			const confirmed = await new Promise<boolean>((resolve) => {
				new DiffModal(this.app, file.path, content, revised, (ok) =>
					resolve(ok)
				).open();
			});
			if (!confirmed) {
				new Notice("Apply cancelled.");
				return;
			}

			const reserved = await this.plugin.reservationManager.reserveFile(file);
			if (!reserved) {
				new Notice("Could not reserve file; edit aborted.");
				return;
			}

			await this.app.vault.modify(file, revised);
			new Notice(
				"Edit applied. It will be auto-committed by the plugin workflow."
			);
		} catch (e: any) {
			new Notice(`Apply error: ${e?.message || e}`);
		}
	}

	private async openFile(filePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file) {
			await this.app.workspace.openLinkText(filePath, "", false);
		}
	}
}
