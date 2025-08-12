import {
	App,
	Modal,
	Setting,
	TAbstractFile,
	TFile,
	TFolder,
	Notice,
} from "obsidian";
import TeamDocsPlugin from "../../main";

export class EditTargetModal extends Modal {
	private selectedPath: string | null = null;
	private fileListEl!: HTMLElement;
	private dirSelectEl!: HTMLSelectElement;
	private nameInputEl!: HTMLInputElement;
	private onPick: (path: string | null) => void;
	private candidates: string[];

	constructor(
		app: App,
		private plugin: TeamDocsPlugin,
		candidates: string[],
		onPick: (path: string | null) => void
	) {
		super(app);
		this.onPick = onPick;
		this.candidates = candidates;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass("edit-target-modal");
		contentEl.createEl("h3", {
			text: "Select file to edit or create a new one",
		});

		const teamRoot = this.plugin.settings.teamDocsPath;
		const subdirs = this.collectSubdirs(teamRoot);

		new Setting(contentEl).setName("Directory").addDropdown((dd) => {
			this.dirSelectEl = dd.selectEl;
			dd.addOption(teamRoot, teamRoot);
			for (const d of subdirs) dd.addOption(d, d);
		});

		const filterSetting = new Setting(contentEl).setName("Filter");
		const filterInput = document.createElement("input");
		filterInput.type = "text";
		filterInput.placeholder = "Search files…";
		filterSetting.controlEl.appendChild(filterInput);

		this.fileListEl = contentEl.createDiv({ cls: "file-list" });
		const files = this.collectMarkdownFiles(teamRoot);
		const initial = this.candidates.length
			? this.candidates
			: files.map((f) => f.path);
		this.renderFileList(initial);

		filterInput.addEventListener("input", () => {
			const q = filterInput.value.toLowerCase();
			const filtered = files
				.filter((f) => f.path.toLowerCase().includes(q))
				.map((f) => f.path);
			this.renderFileList(filtered);
		});

		new Setting(contentEl)
			.setName("New file name")
			.setDesc("Include .md; will be created under the selected directory.")
			.addText((t) => {
				this.nameInputEl = t.inputEl as HTMLInputElement;
				t.setPlaceholder("my-note.md");
			})
			.addButton((b) =>
				b
					.setButtonText("Create")
					.setCta()
					.onClick(async () => {
						try {
							const dir = this.dirSelectEl?.value || teamRoot;
							const name = (this.nameInputEl?.value || "").trim();
							if (!name.endsWith(".md")) {
								new Notice("Please include .md in the filename");
								return;
							}
							const full = `${dir}/${name}`;
							if (!full.startsWith(teamRoot + "/")) {
								new Notice("Invalid path; must be inside team docs folder");
								return;
							}
							const existing = this.app.vault.getAbstractFileByPath(full);
							if (existing) {
								new Notice("File already exists");
								return;
							}
							const folderPath = full.split("/").slice(0, -1).join("/");
							try {
								await this.app.vault.createFolder(folderPath);
							} catch {}
							await this.app.vault.create(full, "");
							this.selectedPath = full;
							this.onPick(this.selectedPath);
							this.close();
						} catch (e: any) {
							new Notice(`Create failed: ${e?.message || e}`);
						}
					})
			);

		new Setting(contentEl).addButton((b) =>
			b.setButtonText("Cancel").onClick(() => {
				this.onPick(null);
				this.close();
			})
		);
	}

	private renderFileList(paths: string[]) {
		this.fileListEl.empty();
		if (paths.length === 0) {
			this.fileListEl.createEl("div", { text: "No files" });
			return;
		}
		const ul = this.fileListEl.createEl("ul", { cls: "file-list-ul" });
		for (const p of paths.slice(0, 500)) {
			const li = ul.createEl("li", { cls: "file-item" });
			const btn = li.createEl("button", { text: p, cls: "file-pick" });
			btn.onclick = () => {
				this.selectedPath = p;
				this.onPick(p);
				this.close();
			};
		}
	}

	private collectMarkdownFiles(root: string): { path: string }[] {
		const out: { path: string }[] = [];
		const { vault } = this.app;
		const walk = (folder: TFolder) => {
			for (const child of folder.children) {
				if (child instanceof TFolder) walk(child);
				else if (child instanceof TFile && child.extension === "md") {
					if (child.path.startsWith(root + "/")) out.push({ path: child.path });
				}
			}
		};
		const rootFolder = vault.getAbstractFileByPath(root);
		if (rootFolder instanceof TFolder) walk(rootFolder);
		return out;
	}

	private collectSubdirs(root: string): string[] {
		const out: string[] = [];
		const { vault } = this.app;
		const walk = (folder: TFolder) => {
			for (const child of folder.children) {
				if (child instanceof TFolder) {
					if (child.path.startsWith(root + "/")) out.push(child.path);
					walk(child);
				}
			}
		};
		const rootFolder = vault.getAbstractFileByPath(root);
		if (rootFolder instanceof TFolder) walk(rootFolder);
		return out;
	}
}
