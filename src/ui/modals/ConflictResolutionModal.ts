import { App, Modal } from "obsidian";

/**
 * Modal for resolving Git merge conflicts
 */
export class ConflictResolutionModal extends Modal {
	private conflictMessage: string;
	private onResolve: (resolution: "theirs" | "mine" | "manual") => void;

	constructor(
		app: App,
		conflictMessage: string,
		onResolve: (resolution: "theirs" | "mine" | "manual") => void
	) {
		super(app);
		this.conflictMessage = conflictMessage;
		this.onResolve = onResolve;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Merge Conflict Detected" });
		contentEl.createEl("p", {
			text: "Changes have been made to the same files by multiple team members. How would you like to resolve this?",
		});

		this.createButtons(contentEl);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private createButtons(contentEl: HTMLElement) {
		const buttonContainer = contentEl.createDiv("conflict-resolution-buttons");
		buttonContainer.style.display = "flex";
		buttonContainer.style.gap = "10px";
		buttonContainer.style.marginTop = "20px";

		const theirsButton = buttonContainer.createEl("button", {
			text: "Use Remote Version",
		});
		theirsButton.addEventListener("click", () => {
			this.onResolve("theirs");
			this.close();
		});

		const mineButton = buttonContainer.createEl("button", {
			text: "Use My Version",
		});
		mineButton.addEventListener("click", () => {
			this.onResolve("mine");
			this.close();
		});

		const manualButton = buttonContainer.createEl("button", {
			text: "Resolve Manually",
		});
		manualButton.addEventListener("click", () => {
			this.onResolve("manual");
			this.close();
		});
	}
}
