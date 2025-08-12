import { App, Modal, Setting } from "obsidian";

export class DiffModal extends Modal {
	constructor(
		app: App,
		private filePath: string,
		private original: string,
		private proposed: string,
		private onCloseResult?: (confirmed: boolean) => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass("diff-modal-wide");
		contentEl.createEl("h3", { text: `Review Changes: ${this.filePath}` });

		const container = contentEl.createDiv({ cls: "diff-modal" });

		const columns = container.createDiv({ cls: "diff-columns" });
		const left = columns.createDiv({ cls: "diff-col" });
		const right = columns.createDiv({ cls: "diff-col" });

		left.createEl("h4", { text: "Current" });
		const leftPre = left.createEl("pre", { cls: "diff-pre" });
		leftPre.textContent = this.original;

		right.createEl("h4", { text: "Proposed" });
		const rightPre = right.createEl("pre", { cls: "diff-pre" });
		rightPre.textContent = this.proposed;

		new Setting(contentEl)
			.addButton((b) =>
				b
					.setButtonText("Apply")
					.setCta()
					.onClick(() => {
						this.onCloseResult?.(true);
						this.close();
					})
			)
			.addButton((b) =>
				b.setButtonText("Cancel").onClick(() => {
					this.onCloseResult?.(false);
					this.close();
				})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
