import type TeamDocsPlugin from "../../main";
import { normalizePath } from "obsidian";

export class ContextStorage {
	constructor(private plugin: TeamDocsPlugin) {}

	private baseDir(): string {
		const pluginId = (this.plugin as any)?.manifest?.id || "team-docs-syncer";
		return `.obsidian/plugins/${pluginId}/plans/files_per_session`;
	}

	async ensureScratchpadTemplate(sessionId: string): Promise<void> {
		const dir = this.sessionDir(sessionId);
		await this.ensureDir(dir);
		const file = normalizePath(`${dir}/scratchpad.md`);
		try {
			const exists = await this.plugin.app.vault.adapter.exists(file);
			if (!exists) {
				const template = `# Scratchpad\n\n## Goals\n- \n\n## Plan\n- \n\n## Progress\n- \n\n## Next\n- \n\n## Decisions\n- \n`;
				await this.plugin.app.vault.adapter.write(file, template);
			}
		} catch (e) {
			console.warn("Failed to ensure scratchpad template:", e);
		}
	}

	async updateScratchpadSection(
		sessionId: string,
		section: string,
		content: string
	): Promise<void> {
		const file = normalizePath(`${this.sessionDir(sessionId)}/scratchpad.md`);
		try {
			const exists = await this.plugin.app.vault.adapter.exists(file);
			if (!exists) {
				await this.ensureScratchpadTemplate(sessionId);
			}
			const current = (await this.plugin.app.vault.adapter.read(file)) || "";
			const secHeader = `## ${section}`;
			const pattern = new RegExp(
				`(^|\n)## ${section.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}[\s\S]*?(?=\n##\s|$)`,
				"m"
			);
			const newBlock = `\n${secHeader}\n${content}\n`;
			let next = current;
			if (pattern.test(current)) {
				next = current.replace(pattern, `\n${newBlock}`);
			} else {
				next = current.trimEnd() + `\n\n${newBlock}`;
			}
			await this.plugin.app.vault.adapter.write(file, next);
		} catch (e) {
			console.warn("Failed to update scratchpad section:", e);
		}
	}

	private sessionDir(sessionId: string): string {
		return `${this.baseDir()}/${sessionId}`;
	}

	private async ensureDir(path: string): Promise<void> {
		const p = normalizePath(path);
		try {
			await this.plugin.app.vault.adapter.mkdir(p);
		} catch (e) {}
	}

	async appendScratchpad(sessionId: string, text: string): Promise<void> {
		const dir = this.sessionDir(sessionId);
		await this.ensureDir(dir);
		const file = normalizePath(`${dir}/scratchpad.md`);
		try {
			const exists = await this.plugin.app.vault.adapter.exists(file);
			const timestamp = new Date().toISOString();
			const block = `\n\n## ${timestamp}\n${text}\n`;
			if (exists) {
				const current = await this.plugin.app.vault.adapter.read(file);
				await this.plugin.app.vault.adapter.write(file, current + block);
			} else {
				await this.plugin.app.vault.adapter.write(
					file,
					`# Scratchpad\n${block}`
				);
			}
		} catch (e) {
			console.warn("Failed to append scratchpad:", e);
		}
	}

	async readScratchpad(sessionId: string): Promise<string | null> {
		const file = normalizePath(`${this.sessionDir(sessionId)}/scratchpad.md`);
		try {
			const exists = await this.plugin.app.vault.adapter.exists(file);
			if (!exists) return null;
			return await this.plugin.app.vault.adapter.read(file);
		} catch (e) {
			return null;
		}
	}

	async writeScratchpad(sessionId: string, content: string): Promise<void> {
		const dir = this.sessionDir(sessionId);
		await this.ensureDir(dir);
		const file = normalizePath(`${dir}/scratchpad.md`);
		try {
			await this.plugin.app.vault.adapter.write(file, content);
		} catch (e) {
			console.warn("Failed to write scratchpad:", e);
		}
	}

	async readScratchpadRecent(
		sessionId: string,
		limitEntries: number = 2
	): Promise<string | null> {
		const full = await this.readScratchpad(sessionId);
		if (!full) return null;
		try {
			const parts = full.split(/\n(?=##\s)/g);
			if (parts.length <= limitEntries + 1) return full;
			const header = parts[0];
			const recent = parts.slice(-limitEntries).join("\n");
			return `${header}\n${recent}`;
		} catch {
			return full;
		}
	}

	async writeSummary(sessionId: string, summary: string): Promise<void> {
		const dir = this.sessionDir(sessionId);
		await this.ensureDir(dir);
		const file = normalizePath(`${dir}/summary.md`);
		try {
			await this.plugin.app.vault.adapter.write(
				file,
				`# Conversation Summary\n\n${summary}\n`
			);
		} catch (e) {
			console.warn("Failed to write summary:", e);
		}
	}

	async readSummary(sessionId: string): Promise<string | null> {
		const file = normalizePath(`${this.sessionDir(sessionId)}/summary.md`);
		try {
			const exists = await this.plugin.app.vault.adapter.exists(file);
			if (!exists) return null;
			return await this.plugin.app.vault.adapter.read(file);
		} catch (e) {
			return null;
		}
	}

	async writeMemories(sessionId: string, items: any[]): Promise<void> {
		const dir = this.sessionDir(sessionId);
		await this.ensureDir(dir);
		const file = normalizePath(`${dir}/memories.json`);
		try {
			await this.plugin.app.vault.adapter.write(
				file,
				JSON.stringify(items, null, 2)
			);
		} catch (e) {
			console.warn("Failed to write memories:", e);
		}
	}

	async readMemories(sessionId: string): Promise<any[]> {
		const file = normalizePath(`${this.sessionDir(sessionId)}/memories.json`);
		try {
			const exists = await this.plugin.app.vault.adapter.exists(file);
			if (!exists) return [];
			const raw = await this.plugin.app.vault.adapter.read(file);
			return JSON.parse(raw || "[]");
		} catch (e) {
			return [];
		}
	}

	/**
	 * Delete only session notes (scratchpad and summary), keeping memories.json.
	 */
	async deleteSessionNotes(sessionId: string): Promise<void> {
		const dir = this.sessionDir(sessionId);
		const scratch = normalizePath(`${dir}/scratchpad.md`);
		const summary = normalizePath(`${dir}/summary.md`);
		try {
			if (await this.plugin.app.vault.adapter.exists(scratch)) {
				await this.plugin.app.vault.adapter.remove(scratch);
			}
		} catch (e) {
			console.warn("Failed to delete scratchpad:", e);
		}
		try {
			if (await this.plugin.app.vault.adapter.exists(summary)) {
				await this.plugin.app.vault.adapter.remove(summary);
			}
		} catch (e) {
			console.warn("Failed to delete summary:", e);
		}
	}
}
