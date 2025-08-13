import { App, Modal, Setting, MarkdownRenderer, Component } from "obsidian";

export class DiffModal extends Modal {
	private hasResult = false;
	private component: Component;

	constructor(
		app: App,
		private filePath: string,
		private original: string,
		private proposed: string,
		private onCloseResult?: (confirmed: boolean) => void
	) {
		super(app);
		this.component = new Component();
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();

		this.modalEl.addClass("diff-modal-fullscreen");

		const header = contentEl.createDiv({ cls: "diff-modal-header" });
		header.createEl("h3", { text: `Review Changes: ${this.filePath}` });

		const viewToggle = header.createDiv({ cls: "diff-view-toggle" });
		const markdownBtn = viewToggle.createEl("button", {
			text: "Rendered",
			cls: "diff-toggle-btn is-active",
		});
		const rawBtn = viewToggle.createEl("button", {
			text: "Raw",
			cls: "diff-toggle-btn",
		});

		const container = contentEl.createDiv({ cls: "diff-modal-content" });
		const columns = container.createDiv({ cls: "diff-columns" });

		const left = columns.createDiv({ cls: "diff-col" });
		const right = columns.createDiv({ cls: "diff-col" });

		left.createEl("h4", { text: "Current" });
		const leftContainer = left.createDiv({ cls: "diff-content-container" });

		right.createEl("h4", { text: "Proposed" });
		const rightContainer = right.createDiv({ cls: "diff-content-container" });

		const leftRendered = leftContainer.createDiv({ cls: "diff-rendered" });
		const leftRaw = leftContainer.createEl("pre", {
			cls: "diff-pre",
			attr: { style: "display: none;" },
		});
		leftRaw.textContent = this.original;

		const rightRendered = rightContainer.createDiv({ cls: "diff-rendered" });
		const rightRaw = rightContainer.createEl("pre", {
			cls: "diff-pre",
			attr: { style: "display: none;" },
		});
		rightRaw.textContent = this.proposed;

		try {
			await MarkdownRenderer.render(
				this.app,
				this.original,
				leftRendered,
				this.filePath,
				this.component
			);
			this.fixInternalLinks(leftRendered);
		} catch (e) {
			console.warn("[DiffModal] Failed to render original markdown:", e);
			leftRendered.textContent = this.original;
		}

		try {
			await MarkdownRenderer.render(
				this.app,
				this.proposed,
				rightRendered,
				this.filePath,
				this.component
			);
			this.fixInternalLinks(rightRendered);
		} catch (e) {
			console.warn("[DiffModal] Failed to render proposed markdown:", e);
			rightRendered.textContent = this.proposed;
		}

		const showRendered = () => {
			leftRendered.style.display = "block";
			rightRendered.style.display = "block";
			leftRaw.style.display = "none";
			rightRaw.style.display = "none";
			markdownBtn.addClass("is-active");
			rawBtn.removeClass("is-active");
		};

		const showRaw = () => {
			leftRendered.style.display = "none";
			rightRendered.style.display = "none";
			leftRaw.style.display = "block";
			rightRaw.style.display = "block";
			markdownBtn.removeClass("is-active");
			rawBtn.addClass("is-active");
		};

		markdownBtn.onclick = showRendered;
		rawBtn.onclick = showRaw;

		showRendered();

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
		this.component.unload();
		this.contentEl.empty();
	}

	private fixInternalLinks(container: HTMLElement) {
		const links = container.querySelectorAll("a.internal-link");
		links.forEach((link) => {
			const href = link.getAttribute("data-href") || link.getAttribute("href");
			if (href) {
				link.removeAttribute("href");
				(link as HTMLElement).onclick = (e) => {
					e.preventDefault();
					link.addClass("internal-link-preview");
				};
				link.addClass("internal-link");
			}
		});
	}
}
