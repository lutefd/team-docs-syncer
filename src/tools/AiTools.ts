import { z } from "zod";
import { tool } from "ai";
import type TeamDocsPlugin from "../../main";
import { TFile } from "obsidian";

export function buildTools(plugin: TeamDocsPlugin) {
	const teamRoot = plugin.settings.teamDocsPath;
	const isInsideTeam = (p: string) =>
		!!teamRoot && p.startsWith(teamRoot + "/");

	return {
		search_docs: tool({
			description:
				"Search markdown documents by title/frontmatter and return brief snippets.",
			inputSchema: z.object({
				query: z.string(),
				k: z.number().int().min(1).max(10).optional(),
			}),
			execute: async ({ query, k = 5 }: { query: string; k?: number }) => {
				const hits = plugin.markdownIndexService?.search(query, k) || [];
				const results: Array<{
					path: string;
					title: string;
					frontmatter?: any;
					snippet?: string;
				}> = [];
				for (const h of hits) {
					let snippet: string | undefined;
					const file = plugin.app.vault.getAbstractFileByPath(h.path);
					if (file instanceof TFile) {
						try {
							const txt = await plugin.app.vault.read(file);
							snippet = txt.slice(0, 300);
						} catch {}
					}
					results.push({
						path: h.path,
						title: h.title,
						frontmatter: h.frontmatter,
						snippet,
					});
				}
				return results;
			},
		}),

		read_doc: tool({
			description:
				"Read full markdown content for a given path within the team docs folder.",
			inputSchema: z.object({ path: z.string() }),
			execute: async ({ path }: { path: string }) => {
				if (!isInsideTeam(path))
					return { error: "outside-sync-folder" } as const;
				const file = plugin.app.vault.getAbstractFileByPath(path);
				if (!(file instanceof TFile)) return { error: "not-found" } as const;
				const content = await plugin.app.vault.read(file);
				return { path, content };
			},
		}),

		propose_edit: tool({
			description:
				"Propose a full updated Markdown for a single file path inside the team docs folder.",
			inputSchema: z.object({
				path: z.string(),
				instructions: z.string().optional(),
			}),
			execute: async ({
				path,
				instructions,
			}: {
				path: string;
				instructions?: string;
			}) => {
				if (!isInsideTeam(path))
					return { error: "outside-sync-folder" } as const;
				return { ok: true, path, instructions: instructions || "" } as const;
			},
		}),

		create_doc: tool({
			description:
				"Create a new markdown file within the team docs folder (guards path). Returns created path.",
			inputSchema: z.object({
				path: z
					.string()
					.describe("Full path including .md under the team docs folder"),
				content: z
					.string()
					.optional()
					.describe("Optional initial markdown content"),
			}),
			execute: async ({
				path,
				content,
			}: {
				path: string;
				content?: string;
			}) => {
				if (!isInsideTeam(path))
					return { error: "outside-sync-folder" } as const;
				const existing = plugin.app.vault.getAbstractFileByPath(path);
				if (existing) return { error: "already-exists", path } as const;
				const folderPath = path.split("/").slice(0, -1).join("/");
				try {
					await plugin.app.vault.createFolder(folderPath);
				} catch {}
				const file = await plugin.app.vault.create(path, content ?? "");
				return { ok: true, path: file.path } as const;
			},
		}),
	} as const;
}
