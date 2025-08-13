import { App, Modal, Setting } from "obsidian";

export class DiffModal extends Modal {
	private hasResult = false;

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

		// Make modal full-screen
		this.modalEl.addClass("diff-modal-fullscreen");

		// Header with file path
		const header = contentEl.createDiv({ cls: "diff-modal-header" });
		header.createEl("h3", { text: `Review Changes: ${this.filePath}` });

		// Main content area with proper scrolling
		const container = contentEl.createDiv({ cls: "diff-modal-content" });
		const columns = container.createDiv({ cls: "diff-columns" });

		const left = columns.createDiv({ cls: "diff-col" });
		const right = columns.createDiv({ cls: "diff-col" });

		left.createEl("h4", { text: "Current" });
		const leftContainer = left.createDiv({ cls: "diff-content-container" });
		const leftPre = leftContainer.createEl("pre", { cls: "diff-pre" });
		leftPre.textContent = this.original;

		right.createEl("h4", { text: "Proposed" });
		const rightContainer = right.createDiv({ cls: "diff-content-container" });
		const rightPre = rightContainer.createEl("pre", { cls: "diff-pre" });
		rightPre.textContent = this.proposed;

		new Setting(contentEl)
			.addButton((b) =>
				b
					.setButtonText("Apply")
					.setCta()
					.onClick(() => {
						this.hasResult = true;
						this.onCloseResult?.(true);
						this.close();
					})
			)
			.addButton((b) =>
				b.setButtonText("Cancel").onClick(() => {
					this.hasResult = true;
					this.onCloseResult?.(false);
					this.close();
				})
			);
	}

	onClose(): void {
		if (!this.hasResult) {
			this.onCloseResult?.(false);
		}
		this.contentEl.empty();
	}
}
