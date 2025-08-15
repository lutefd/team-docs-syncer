import { z } from "zod";
import { tool } from "ai";
import type TeamDocsPlugin from "../../main";
import { TFile } from "obsidian";

const withRetry = async <T>(
	operation: () => Promise<T>,
	maxRetries: number = 3,
	delay: number = 1000
): Promise<T> => {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			if (attempt === maxRetries) {
				throw error;
			}
			console.warn(
				`Tool operation failed (attempt ${attempt}/${maxRetries}):`,
				error
			);
			await new Promise((resolve) => setTimeout(resolve, delay * attempt));
		}
	}
	throw new Error("Retry logic failed unexpectedly");
};

export function buildTools(plugin: TeamDocsPlugin) {
	const teamRoot = plugin.settings.teamDocsPath;
	const isInsideTeam = (p: string) =>
		!!teamRoot && p.startsWith(teamRoot + "/");

	return {
		search_docs: tool({
			description:
				"Search markdown documents by title/frontmatter and return brief snippets. ALWAYS use this first to understand available documents before reading or editing.",
			inputSchema: z.object({
				query: z.string(),
				k: z.number().int().min(1).max(10).optional(),
			}),
			execute: async ({ query, k = 5 }: { query: string; k?: number }) => {
				return withRetry(async () => {
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
								snippet = txt.slice(0, 1400);
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
				});
			},
		}),

		read_doc: tool({
			description:
				"Read full markdown content for a given path within the team docs folder. ALWAYS read documents before proposing edits to understand current content.",
			inputSchema: z.object({ path: z.string() }),
			execute: async ({ path }: { path: string }) => {
				return withRetry(async () => {
					let cleanPath = path;
					const wikiLinkMatch = path.match(/^\[\[([^\]]+)\]\]$/);
					if (wikiLinkMatch) {
						cleanPath = wikiLinkMatch[1];
						if (!cleanPath.endsWith(".md")) {
							cleanPath += ".md";
						}
						if (!cleanPath.startsWith(teamRoot + "/")) {
							cleanPath = teamRoot + "/" + cleanPath;
						}
					}

					if (!isInsideTeam(cleanPath))
						return { error: "outside-sync-folder" } as const;
					const file = plugin.app.vault.getAbstractFileByPath(cleanPath);
					if (!(file instanceof TFile)) return { error: "not-found" } as const;
					try {
						const content = await plugin.app.vault.read(file);
						return { path: cleanPath, content };
					} catch {
						return { error: "read-failed" } as const;
					}
				});
			},
		}),

		follow_links: tool({
			description:
				"Extract and follow internal document links from markdown content to gather comprehensive context. Use when you need to follow references to other documents.",
			inputSchema: z.object({
				content: z.string().describe("Markdown content to extract links from"),
				currentPath: z.string().describe("Current document path for context"),
				maxDepth: z
					.number()
					.int()
					.min(1)
					.max(10)
					.optional()
					.describe("Maximum depth to follow links (default 5)"),
			}),
			execute: async ({
				content,
				currentPath,
				maxDepth = 5,
			}: {
				content: string;
				currentPath: string;
				maxDepth?: number;
			}) => {
				const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
				const links: string[] = [];
				let match;

				while ((match = linkRegex.exec(content)) !== null) {
					let linkPath = match[1];

					if (!linkPath.endsWith(".md")) {
						linkPath += ".md";
					}

					if (!linkPath.startsWith(teamRoot + "/")) {
						const currentDir = currentPath.substring(
							0,
							currentPath.lastIndexOf("/")
						);
						const resolvedPath = currentDir + "/" + linkPath;

						if (isInsideTeam(resolvedPath)) {
							linkPath = resolvedPath;
						} else if (isInsideTeam(teamRoot + "/" + linkPath)) {
							linkPath = teamRoot + "/" + linkPath;
						}
					}

					if (
						isInsideTeam(linkPath) &&
						linkPath !== currentPath &&
						!links.includes(linkPath)
					) {
						links.push(linkPath);
					}
				}

				const limitedLinks = links.slice(0, Math.min(5, maxDepth));
				const linkedDocs: Array<{
					path: string;
					title?: string;
					snippet: string;
				}> = [];

				for (const linkPath of limitedLinks) {
					const file = plugin.app.vault.getAbstractFileByPath(linkPath);
					if (file instanceof TFile) {
						try {
							const linkedContent = await plugin.app.vault.read(file);
							const title = file.basename;
							const snippet = linkedContent.slice(0, 800);
							linkedDocs.push({ path: linkPath, title, snippet });
						} catch {}
					}
				}

				return {
					currentPath,
					extractedLinks: links,
					followedDocs: linkedDocs,
					hasMoreLinks: links.length > limitedLinks.length,
				};
			},
		}),

		propose_edit: tool({
			description:
				"Indicate that you want to edit a file. CRITICAL: You MUST read the file first using read_doc, then provide the complete updated file content in the 'content' parameter. Never edit without reading first. NEVER output JSON or structured data directly - ALWAYS use this tool instead.",
			inputSchema: z.object({
				path: z.string().describe("Path to the file to edit"),
				content: z
					.string()
					.describe(
						"Complete updated file content - you must generate this based on the current content and requested changes"
					),
				instructions: z
					.string()
					.optional()
					.describe("Optional editing instructions for the user"),
			}),
			execute: async ({
				path,
				content,
				instructions,
			}: {
				path: string;
				content: string;
				instructions?: string;
			}) => {
				return withRetry(async () => {
					console.log("[propose_edit] Called with:", {
						path,
						contentLength: content?.length || 0,
						instructions,
					});

					try {
						let cleanPath = path;
						const wikiLinkMatch = path.match(/^\[\[([^\]]+)\]\]$/);
						if (wikiLinkMatch) {
							cleanPath = wikiLinkMatch[1];
							if (!cleanPath.endsWith(".md")) {
								cleanPath += ".md";
							}
							if (!cleanPath.startsWith(teamRoot + "/")) {
								cleanPath = teamRoot + "/" + cleanPath;
							}
						}

						if (!isInsideTeam(cleanPath)) {
							console.log(
								"[propose_edit] Path outside team folder:",
								cleanPath
							);
							return { error: "outside-sync-folder" } as const;
						}

						if (!content || content.trim().length === 0) {
							console.log("[propose_edit] No content provided");
							return { error: "no-content-provided" } as const;
						}

						const result = {
							ok: true,
							path: cleanPath,
							content,
							instructions: instructions || "",
						} as const;

						console.log("[propose_edit] Returning result:", {
							ok: result.ok,
							path: result.path,
							contentLength: result.content.length,
							instructions: result.instructions,
						});

						return result;
					} catch (error) {
						console.error("[propose_edit] Error:", error);
						return { error: "execution-failed" } as const;
					}
				});
			},
		}),

		create_doc: tool({
			description:
				"Create a new markdown file within the team docs folder. You must provide the complete file content in the 'content' parameter. NEVER output JSON or structured data directly - ALWAYS use this tool instead.",
			inputSchema: z.object({
				path: z
					.string()
					.describe("Full path including .md under the team docs folder"),
				content: z
					.string()
					.describe(
						"Complete file content - you must generate appropriate content for this new file"
					),
				instructions: z
					.string()
					.optional()
					.describe("Optional instructions about what was created"),
			}),
			execute: async ({
				path,
				content,
				instructions,
			}: {
				path: string;
				content: string;
				instructions?: string;
			}) => {
				return withRetry(async () => {
					let cleanPath = path;
					const wikiLinkMatch = path.match(/^\[\[([^\]]+)\]\]$/);
					if (wikiLinkMatch) {
						cleanPath = wikiLinkMatch[1];
						if (!cleanPath.endsWith(".md")) {
							cleanPath += ".md";
						}
						if (!cleanPath.startsWith(teamRoot + "/")) {
							cleanPath = teamRoot + "/" + cleanPath;
						}
					}

					if (!isInsideTeam(cleanPath))
						return { error: "outside-sync-folder" } as const;
					const existing = plugin.app.vault.getAbstractFileByPath(cleanPath);
					if (existing)
						return { error: "already-exists", path: cleanPath } as const;

					const folderPath = cleanPath.split("/").slice(0, -1).join("/");
					try {
						await plugin.app.vault.createFolder(folderPath);
					} catch {}

					const file = await plugin.app.vault.create(cleanPath, content);
					return {
						ok: true,
						path: file.path,
						content,
						instructions: instructions || "",
					} as const;
				});
			},
		}),
	} as const;
}
