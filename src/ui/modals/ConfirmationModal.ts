import { App, Modal } from "obsidian";

/**
 * Generic confirmation modal for user actions
 */
export class ConfirmationModal extends Modal {
	private onConfirm: (confirm: boolean) => void;
	private title: string;
	private message: string;

	constructor(
		app: App,
		title: string,
		message: string,
		onConfirm: (confirm: boolean) => void
	) {
		super(app);
		this.title = title;
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		this.titleEl.setText(this.title);
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("p", { text: this.message });

		this.createButtons(contentEl);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private createButtons(contentEl: HTMLElement) {
		const buttonContainer = contentEl.createDiv();
		buttonContainer.style.display = "flex";
		buttonContainer.style.gap = "10px";
		buttonContainer.style.marginTop = "20px";

		const yesButton = buttonContainer.createEl("button", { text: "Yes" });
		yesButton.addEventListener("click", () => {
			this.onConfirm(true);
			this.close();
		});

		const noButton = buttonContainer.createEl("button", { text: "No" });
		noButton.addEventListener("click", () => {
			this.onConfirm(false);
			this.close();
		});
	}
}
