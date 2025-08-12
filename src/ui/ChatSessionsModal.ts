import { App, Modal, Setting } from "obsidian";
import TeamDocsPlugin from "../../main";

export class ChatSessionsModal extends Modal {
	constructor(
		app: App,
		private plugin: TeamDocsPlugin,
		private onChange?: () => void
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: "Chat Sessions" });

		const listEl = contentEl.createDiv({ cls: "chat-sessions-list" });

		const renderList = () => {
			listEl.empty();
			const sessions = this.plugin.chatSessionService.list();
			sessions.forEach((s) => {
				const row = listEl.createDiv({ cls: "chat-session-row" });
				row.createSpan({ text: s.title });

				new Setting(row)
					.addButton((b) =>
						b.setButtonText("Open").onClick(() => {
							this.plugin.chatSessionService.setActive(s.id);
							this.onChange?.();
							this.close();
						})
					)
					.addButton((b) =>
						b.setButtonText("Rename").onClick(() => {
							const name = prompt("Rename chat", s.title) || s.title;
							this.plugin.chatSessionService.rename(s.id, name);
							renderList();
							this.onChange?.();
						})
					)
					.addButton((b) =>
						b.setButtonText("Delete").onClick(() => {
							if (confirm("Delete this chat?")) {
								this.plugin.chatSessionService.remove(s.id);
								renderList();
								this.onChange?.();
							}
						})
					);
			});
		};

		new Setting(contentEl).setName("New Chat").addButton((b) =>
			b.setButtonText("Create").onClick(() => {
				this.plugin.chatSessionService.createSession();
				renderList();
				this.onChange?.();
			})
		);

		renderList();
	}

	onClose() {
		this.contentEl.empty();
	}
}
