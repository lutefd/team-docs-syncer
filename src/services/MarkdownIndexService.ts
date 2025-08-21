import { App, TFile } from "obsidian";
import TeamDocsPlugin from "../../main";
import { PathUtils } from "src/utils/PathUtils";

export interface DocMeta {
	path: string;
	title: string;
	frontmatter: Record<string, any> | undefined;
	updatedAt: number;
}

export class MarkdownIndexService {
	private index: Map<string, DocMeta> = new Map();
	private initialized = false;

	constructor(private app: App, private plugin: TeamDocsPlugin) {}

	async init(): Promise<void> {
		if (this.initialized) return;
		await this.rebuildIndex();
		this.plugin.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (
					file instanceof TFile &&
					PathUtils.isWithinAiScope(
						file.path,
						this.plugin.settings.teamDocsPath
					) &&
					file.extension === "md"
				) {
					void this.updateFile(file);
				}
			})
		);
		this.plugin.registerEvent(
			this.app.vault.on("create", (file) => {
				if (
					file instanceof TFile &&
					PathUtils.isWithinAiScope(
						file.path,
						this.plugin.settings.teamDocsPath
					) &&
					file.extension === "md"
				) {
					void this.updateFile(file);
				}
			})
		);
		this.plugin.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (
					file instanceof TFile &&
					PathUtils.isWithinAiScope(
						file.path,
						this.plugin.settings.teamDocsPath
					)
				) {
					this.index.delete(file.path);
				}
			})
		);
		this.initialized = true;
	}

	async rebuildIndex(): Promise<void> {
		this.index.clear();
		const mdFiles = this.app.vault.getMarkdownFiles();
		const root = this.plugin.settings.teamDocsPath;
		for (const f of mdFiles) {
			if (!PathUtils.isWithinAiScope(f.path, root)) continue;
			await this.updateFile(f);
		}
	}

	private async updateFile(file: TFile): Promise<void> {
		const cache = this.app.metadataCache.getFileCache(file as TFile);
		const fm = cache?.frontmatter as any | undefined;
		const title = (fm?.title as string) || file.basename;
		const meta: DocMeta = {
			path: file.path,
			title,
			frontmatter: fm,
			updatedAt: Date.now(),
		};
		this.index.set(file.path, meta);
	}

	search(query: string, k: number = 5): DocMeta[] {
		const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
		const scored: Array<{ m: DocMeta; s: number }> = [];
		for (const m of this.index.values()) {
			let score = 0;
			const hayTitle = m.title.toLowerCase();
			const hayPath = m.path.toLowerCase();
			const fm = m.frontmatter
				? JSON.stringify(m.frontmatter).toLowerCase()
				: "";
			for (const t of terms) {
				if (hayTitle.includes(t)) score += 5;
				if (fm.includes(t)) score += 3;
				if (hayPath.includes(t)) score += 1;
			}
			if (score > 0) scored.push({ m, s: score });
		}
		scored.sort((a, b) => b.s - a.s || b.m.updatedAt - a.m.updatedAt);
		return scored.slice(0, k).map((x) => x.m);
	}
}
