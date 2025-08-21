import { App, Modal } from "obsidian";

/**
 * Modal for handling local changes that would be overwritten
 */
export class LocalChangesModal extends Modal {
	private onResolve: (action: "commit" | "stash" | "discard") => void;

	constructor(
		app: App,
		onResolve: (action: "commit" | "stash" | "discard") => void
	) {
		super(app);
		this.onResolve = onResolve;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Local Changes Detected" });
		contentEl.createEl("p", {
			text: "You have local changes that would be overwritten. How would you like to handle them?",
		});

		this.createButtons(contentEl);
		this.createDescriptions(contentEl);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private createButtons(contentEl: HTMLElement) {
		const buttonContainer = contentEl.createDiv("local-changes-buttons");
		buttonContainer.style.display = "flex";
		buttonContainer.style.gap = "10px";
		buttonContainer.style.marginTop = "20px";

		const commitButton = buttonContainer.createEl("button", {
			text: "Commit & Sync",
		});
		commitButton.addEventListener("click", () => {
			this.onResolve("commit");
			this.close();
		});

		const stashButton = buttonContainer.createEl("button", {
			text: "Stash & Sync",
		});
		stashButton.addEventListener("click", () => {
			this.onResolve("stash");
			this.close();
		});

		const discardButton = buttonContainer.createEl("button", {
			text: "Discard & Sync",
		});
		discardButton.style.color = "#f44336";
		discardButton.addEventListener("click", () => {
			this.onResolve("discard");
			this.close();
		});
	}

	private createDescriptions(contentEl: HTMLElement) {
		const descriptions = contentEl.createDiv("option-descriptions");
		descriptions.style.marginTop = "15px";
		descriptions.style.fontSize = "12px";
		descriptions.style.opacity = "0.8";

		descriptions.createEl("div", {
			text: "• Commit & Sync: Save your changes and merge with remote",
		});
		descriptions.createEl("div", {
			text: "• Stash & Sync: Temporarily save changes, sync, then reapply",
		});
		descriptions.createEl("div", {
			text: "• Discard & Sync: Permanently lose local changes and use remote version",
		});
	}
}
