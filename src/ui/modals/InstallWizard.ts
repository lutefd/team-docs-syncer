import { App, FileSystemAdapter, Modal, Notice } from "obsidian";
import * as path from "path";
import * as fs from "fs";
import * as fsp from "fs/promises";
import TeamDocsPlugin from "../../../main";

/**
 * First-time install/setup wizard.
 * Walks the user through: remote URL -> clone -> folder name -> git configs.
 */
export class InstallWizard extends Modal {
	private plugin: TeamDocsPlugin;
	private step: number = 0;
	private repoUrl: string = "";
	private clonedPath: string | null = null;
	private desiredName: string = "";
	private userName: string = "";
	private userEmail: string = "";

	constructor(app: App, plugin: TeamDocsPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		this.titleEl.setText("Team Docs – First-time Setup");
		this.plugin.installingWizard = true;
		this.render();
	}

	onClose(): void {
		this.plugin.installingWizard = false;
		this.contentEl.empty();
	}

	private render() {
		this.contentEl.empty();
		if (this.step === 0) this.renderRemoteStep();
		else if (this.step === 1) this.renderNameStep();
		else if (this.step === 2) this.renderGitConfigStep();
		else this.renderDone();
	}

	private renderRemoteStep() {
		const el = this.contentEl;
		el.createEl("p", {
			text: "Enter the Git remote URL to clone your team docs repository into this vault.",
		});

		const input = el.createEl("input", { type: "text" });
		input.placeholder = "https://github.com/your-org/your-repo.git";
		input.style.width = "100%";
		input.value = this.repoUrl;

		const btn = el.createEl("button", { text: "Clone Repository" });
		btn.style.marginTop = "12px";

		const status = el.createDiv();
		status.style.marginTop = "8px";
		status.style.fontSize = "12px";
		status.style.opacity = "0.8";

		btn.onclick = async () => {
			this.repoUrl = input.value.trim();
			if (!this.repoUrl) {
				new Notice("Please enter a valid Git remote URL.");
				return;
			}

			try {
				btn.setAttr("disabled", "true");
				input.setAttr("disabled", "true");
				status.setText("Cloning... this may take a moment");

				const adapter = this.app.vault.adapter;
				if (!(adapter instanceof FileSystemAdapter)) {
					throw new Error(
						"Desktop-only operation: FileSystemAdapter unavailable"
					);
				}

				const baseName = this.inferRepoName(this.repoUrl);
				const initialRel = await this.findAvailableFolderName(baseName);
				const absTarget = adapter.getFullPath(initialRel);
				const parentDir = path.dirname(absTarget);

				await this.plugin.gitService.gitCommandRetry(
					parentDir,
					`clone "${this.repoUrl}" "${absTarget}"`
				);

				this.clonedPath = absTarget;
				this.desiredName = path.basename(absTarget);
				this.step = 1;
				this.render();
			} catch (err: any) {
				btn.removeAttribute("disabled");
				input.removeAttribute("disabled");
				status.setText("");
				new Notice(`Clone failed: ${err?.message || err}`);
			}
		};
	}

	private renderNameStep() {
		const el = this.contentEl;
		el.createEl("p", {
			text: "What should this folder be called inside your vault?",
		});

		const input = el.createEl("input", { type: "text" });
		input.placeholder = "TeamDocs";
		input.style.width = "100%";
		input.value = this.desiredName || "TeamDocs";

		const hint = el.createDiv({
			text: "This will also set the Team Docs root in plugin settings.",
		});
		hint.style.fontSize = "12px";
		hint.style.opacity = "0.8";

		const backBtn = el.createEl("button", { text: "Back" });
		backBtn.style.marginTop = "12px";
		const nextBtn = el.createEl("button", { text: "Next" });
		nextBtn.style.marginTop = "12px";
		nextBtn.style.marginLeft = "8px";

		backBtn.onclick = () => {
			this.step = 0;
			this.render();
		};

		nextBtn.onclick = async () => {
			const name = input.value.trim() || "TeamDocs";
			try {
				if (!this.clonedPath) throw new Error("Missing cloned path");
				const adapter = this.app.vault.adapter as FileSystemAdapter;
				const currentBase = path.basename(this.clonedPath);
				let finalAbs = this.clonedPath;

				if (name !== currentBase) {
					const targetAbs = adapter.getFullPath(name);
					if (fs.existsSync(targetAbs)) {
						new Notice(
							"A folder with this name already exists. Choose another."
						);
						return;
					}
					await fsp.rename(this.clonedPath, targetAbs);
					finalAbs = targetAbs;
				}

				this.plugin.settings.teamDocsPath = name;
				this.plugin.settings.gitRemoteUrl = this.repoUrl;
				this.plugin.settings.attachmentsSubdir = "Meta/Attachments";
				await this.plugin.saveSettings();

				this.clonedPath = finalAbs;
				this.desiredName = name;
				this.step = 2;
				this.render();
			} catch (err: any) {
				new Notice(`Rename failed: ${err?.message || err}`);
			}
		};
	}

	private renderGitConfigStep() {
		const el = this.contentEl;
		el.createEl("p", {
			text: "Configure your Git identity for this repository.",
		});

		const nameInput = el.createEl("input", { type: "text" });
		nameInput.placeholder = "Your Name";
		nameInput.style.width = "100%";
		nameInput.value = this.userName;

		const emailInput = el.createEl("input", { type: "email" });
		emailInput.placeholder = "you@example.com";
		emailInput.style.width = "100%";
		emailInput.style.marginTop = "8px";
		emailInput.value = this.userEmail;

		const backBtn = el.createEl("button", { text: "Back" });
		backBtn.style.marginTop = "12px";
		const finishBtn = el.createEl("button", { text: "Finish Setup" });
		finishBtn.style.marginTop = "12px";
		finishBtn.style.marginLeft = "8px";

		backBtn.onclick = () => {
			this.step = 1;
			this.render();
		};

		finishBtn.onclick = async () => {
			this.userName = nameInput.value.trim();
			this.userEmail = emailInput.value.trim();
			if (!this.userName || !this.userEmail) {
				new Notice("Please enter your name and email.");
				return;
			}

			try {
				if (!this.clonedPath) throw new Error("Missing repo path");

				await this.plugin.gitService.gitCommandRetry(
					this.clonedPath,
					"config pull.rebase false"
				);
				await this.plugin.gitService.gitCommandRetry(
					this.clonedPath,
					`config user.name "${this.userName}"`
				);
				await this.plugin.gitService.gitCommandRetry(
					this.clonedPath,
					`config user.email "${this.userEmail}"`
				);

				this.plugin.settings.userName = this.userName;
				this.plugin.settings.userEmail = this.userEmail;
				await this.plugin.saveSettings();

				this.step = 3;
				this.render();
			} catch (err: any) {
				new Notice(`Git configuration failed: ${err?.message || err}`);
			}
		};
	}

	private renderDone() {
		const el = this.contentEl;
		el.createEl("h3", { text: "Setup Complete" });
		el.createEl("p", {
			text: "You're ready to start collaborating in Team Docs.",
		});
		const closeBtn = el.createEl("button", { text: "Close" });
		closeBtn.style.marginTop = "12px";
		closeBtn.onclick = () => {
			this.plugin.installingWizard = false;
			this.close();
		};
	}

	private inferRepoName(url: string): string {
		try {
			const cleaned = url.replace(/\?.*$/, "");
			const last = cleaned.split("/").pop() || "TeamDocs";
			return last.replace(/\.git$/, "") || "TeamDocs";
		} catch {
			return "TeamDocs";
		}
	}

	private async findAvailableFolderName(base: string): Promise<string> {
		const adapter = this.app.vault.adapter as FileSystemAdapter;
		let name = base || "TeamDocs";
		for (let i = 0; i < 100; i++) {
			const candidate = i === 0 ? name : `${name}-${i}`;
			const abs = adapter.getFullPath(candidate);
			if (!fs.existsSync(abs)) return candidate;
		}
		return `${base}-${Date.now()}`;
	}
}
