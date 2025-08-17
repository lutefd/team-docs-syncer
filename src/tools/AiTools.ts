import { z } from "zod";
import { tool } from "ai";
import type TeamDocsPlugin from "../../main";
import { TAbstractFile, TFile, TFolder } from "obsidian";

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

const cleanAndResolvePath = (path: string, teamRoot: string): string => {
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
	return cleanPath;
};

export function buildTools(plugin: TeamDocsPlugin) {
	const teamRoot = plugin.settings.teamDocsPath;
	const isInsideTeam = (p: string) =>
		!!teamRoot && p.startsWith(teamRoot + "/");

	return {
		search_docs: tool({
			description:
				"Search internal Obsidian team docs by title/frontmatter and return brief snippets. This tool is ONLY for team documentation within Obsidian. For external searches, web content, or broader functionality, prefer MCP tools if available. ALWAYS use this first to understand available team documents before reading or editing.",
			inputSchema: z.object({
				query: z.string(),
				k: z.number().int().min(1).max(10).optional(),
				snippetLength: z.number().int().min(100).max(2000).optional(),
			}),
			execute: async ({
				query,
				k = 5,
				snippetLength = 1400,
			}: {
				query: string;
				k?: number;
				snippetLength?: number;
			}) => {
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
								snippet = txt.slice(0, snippetLength);
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
				"Read full markdown content for internal Obsidian team docs only. This tool is restricted to team documentation within the configured sync folder. For reading external files, web content, or other document types, use MCP tools if available. ALWAYS read documents before proposing edits to understand current content.",
			inputSchema: z.object({ path: z.string() }),
			execute: async ({ path }: { path: string }) => {
				return withRetry(async () => {
					const cleanPath = cleanAndResolvePath(path, teamRoot);

					if (!isInsideTeam(cleanPath)) {
						return {
							error: {
								code: "outside-sync-folder",
								message: `Path '${cleanPath}' is outside the team docs folder.`,
							},
						};
					}
					const file = plugin.app.vault.getAbstractFileByPath(cleanPath);
					if (!(file instanceof TFile)) {
						return {
							error: {
								code: "not-found",
								message: `File not found: ${cleanPath}`,
							},
						};
					}
					try {
						const content = await plugin.app.vault.read(file);
						return { path: cleanPath, content };
					} catch (e) {
						return {
							error: {
								code: "read-failed",
								message: `Failed to read file: ${e.message}`,
							},
						};
					}
				});
			},
		}),

		follow_links: tool({
			description:
				"Extract and follow internal Obsidian team doc links from markdown content to gather comprehensive context. This tool only works within the team docs folder. For following external links, web links, or broader link analysis, use MCP tools if available. Use when you need to follow references to other team documents. Supports recursion up to maxDepth.",
			inputSchema: z.object({
				content: z.string().describe("Markdown content to extract links from"),
				currentPath: z.string().describe("Current document path for context"),
				maxDepth: z
					.number()
					.int()
					.min(1)
					.max(10)
					.optional()
					.describe("Maximum recursion depth (default 1)"),
				maxLinksPerLevel: z
					.number()
					.int()
					.min(1)
					.max(20)
					.optional()
					.describe("Max links to follow per level (default 5)"),
				snippetLength: z
					.number()
					.int()
					.min(100)
					.max(2000)
					.optional()
					.describe("Snippet length for followed docs (default 800)"),
			}),
			execute: async ({
				content,
				currentPath,
				maxDepth = 1,
				maxLinksPerLevel = 5,
				snippetLength = 800,
			}: {
				content: string;
				currentPath: string;
				maxDepth?: number;
				maxLinksPerLevel?: number;
				snippetLength?: number;
			}) => {
				const followedDocs: Array<{
					path: string;
					title?: string;
					snippet: string;
					depth: number;
				}> = [];
				const visited = new Set<string>();

				const extractAndFollow = async (
					mdContent: string,
					path: string,
					depth: number
				) => {
					if (depth > maxDepth || visited.has(path)) return;
					visited.add(path);

					const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
					const links: string[] = [];
					let match;

					while ((match = linkRegex.exec(mdContent)) !== null) {
						let linkPath = match[1];
						if (!linkPath.endsWith(".md")) linkPath += ".md";

						if (!linkPath.startsWith(teamRoot + "/")) {
							const currentDir = path.substring(0, path.lastIndexOf("/"));
							const resolvedPath = currentDir + "/" + linkPath;
							linkPath = isInsideTeam(resolvedPath)
								? resolvedPath
								: teamRoot + "/" + linkPath;
						}

						if (
							isInsideTeam(linkPath) &&
							linkPath !== path &&
							!visited.has(linkPath) &&
							!links.includes(linkPath)
						) {
							links.push(linkPath);
						}
					}

					const limitedLinks = links.slice(0, maxLinksPerLevel);
					for (const linkPath of limitedLinks) {
						const file = plugin.app.vault.getAbstractFileByPath(linkPath);
						if (file instanceof TFile) {
							try {
								const linkedContent = await plugin.app.vault.read(file);
								const title = file.basename;
								const snippet = linkedContent.slice(0, snippetLength);
								followedDocs.push({ path: linkPath, title, snippet, depth });

								await extractAndFollow(linkedContent, linkPath, depth + 1);
							} catch {}
						}
					}
				};

				await extractAndFollow(content, currentPath, 1);

				return {
					currentPath,
					followedDocs,
					hasMore: visited.size < followedDocs.length,
				};
			},
		}),

		propose_edit: tool({
			description:
				"Edit internal Obsidian team docs only. This tool is restricted to team documentation within the configured sync folder. For editing external files, code files, or other document types, use MCP tools if available. CRITICAL: You MUST read the file first using read_doc, then provide the complete updated file content in the 'content' parameter. Never edit without reading first. NEVER output JSON or structured data directly - ALWAYS use this tool instead.",
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

					const cleanPath = cleanAndResolvePath(path, teamRoot);

					if (!isInsideTeam(cleanPath)) {
						console.log("[propose_edit] Path outside team folder:", cleanPath);
						return {
							error: {
								code: "outside-sync-folder",
								message: `Path '${cleanPath}' is outside the team docs folder.`,
							},
						};
					}

					if (!content || content.trim().length === 0) {
						console.log("[propose_edit] No content provided");
						return {
							error: {
								code: "no-content-provided",
								message: "Content must be provided for edits.",
							},
						};
					}

					const result = {
						ok: true,
						path: cleanPath,
						content,
						instructions: instructions || "",
					};

					console.log("[propose_edit] Returning result:", {
						ok: result.ok,
						path: result.path,
						contentLength: result.content.length,
						instructions: result.instructions,
					});

					return result;
				});
			},
		}),

		create_doc: tool({
			description:
				"Create new markdown files within the internal Obsidian team docs folder only. This tool is restricted to team documentation within the configured sync folder. For creating external files, code files, or other document types, use MCP tools if available. You must provide the complete file content in the 'content' parameter. NEVER output JSON or structured data directly - ALWAYS use this tool instead.",
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
					const cleanPath = cleanAndResolvePath(path, teamRoot);

					if (!isInsideTeam(cleanPath)) {
						return {
							error: {
								code: "outside-sync-folder",
								message: `Path '${cleanPath}' is outside the team docs folder.`,
							},
						};
					}
					const existing = plugin.app.vault.getAbstractFileByPath(cleanPath);
					if (existing) {
						return {
							error: {
								code: "already-exists",
								message: `File already exists: ${cleanPath}`,
							},
						};
					}

					const folderPath = cleanPath.split("/").slice(0, -1).join("/");
					try {
						await plugin.app.vault.createFolder(folderPath);
					} catch {}

					try {
						const file = await plugin.app.vault.create(cleanPath, content);
						return {
							ok: true,
							path: file.path,
							content,
							instructions: instructions || "",
						};
					} catch (e) {
						return {
							error: {
								code: "create-failed",
								message: `Failed to create file: ${e.message}`,
							},
						};
					}
				});
			},
		}),

		list_docs: tool({
			description:
				"List files and folders within internal Obsidian team docs folder only. This tool is restricted to team documentation within the configured sync folder. For listing external directories, system files, or broader file operations, use MCP tools if available. Use to browse the team docs structure before searching or reading.",
			inputSchema: z.object({
				path: z
					.string()
					.optional()
					.describe("Folder path to list (default: team root)"),
				recursive: z
					.boolean()
					.optional()
					.describe("Recursively list subfolders (default: false)"),
				maxDepth: z
					.number()
					.int()
					.min(1)
					.max(10)
					.optional()
					.describe("Max recursion depth if recursive (default: 3)"),
				filterExtension: z
					.string()
					.optional()
					.describe("Filter by file extension (e.g., '.md')"),
			}),
			execute: async ({
				path,
				recursive = false,
				maxDepth = 3,
				filterExtension,
			}: {
				path?: string;
				recursive?: boolean;
				maxDepth?: number;
				filterExtension?: string;
			}) => {
				return withRetry(async () => {
					const cleanPath = path
						? cleanAndResolvePath(path, teamRoot)
						: teamRoot;
					if (!isInsideTeam(cleanPath)) {
						return {
							error: {
								code: "outside-sync-folder",
								message: `Path '${cleanPath}' is outside the team docs folder.`,
							},
						};
					}

					const results: Array<{
						path: string;
						type: "file" | "folder";
						size?: number;
						modified?: string;
					}> = [];

					const listRecursive = (folder: TFolder, currentDepth: number) => {
						if (currentDepth > maxDepth) return;
						for (const child of folder.children) {
							if (child instanceof TFile) {
								if (!filterExtension || child.path.endsWith(filterExtension)) {
									results.push({
										path: child.path,
										type: "file",
										size: child.stat.size,
										modified: new Date(child.stat.mtime).toISOString(),
									});
								}
							} else if (child instanceof TFolder) {
								results.push({
									path: child.path,
									type: "folder",
								});
								if (recursive) {
									listRecursive(child, currentDepth + 1);
								}
							}
						}
					};

					const rootFolder = plugin.app.vault.getAbstractFileByPath(cleanPath);
					if (!(rootFolder instanceof TFolder)) {
						return {
							error: {
								code: "not-folder",
								message: `Path '${cleanPath}' is not a folder.`,
							},
						};
					}

					listRecursive(rootFolder, 1);
					return { path: cleanPath, items: results };
				});
			},
		}),

		search_tags: tool({
			description:
				"Search for tags within internal Obsidian team docs only. This tool is restricted to team documentation within the configured sync folder. For searching external tags, web content, or broader tag systems, use MCP tools if available. Search for markdown documents containing a specific tag (e.g., '#project') or frontmatter key. Returns brief snippets. Use to find tagged team content.",
			inputSchema: z.object({
				tag: z
					.string()
					.describe(
						"Tag to search for (e.g., '#project' or frontmatter key like 'status: active')"
					),
				k: z.number().int().min(1).max(20).optional(),
				snippetLength: z.number().int().min(100).max(2000).optional(),
			}),
			execute: async ({
				tag,
				k = 5,
				snippetLength = 800,
			}: {
				tag: string;
				k?: number;
				snippetLength?: number;
			}) => {
				return withRetry(async () => {
					const results: Array<{
						path: string;
						title: string;
						snippet?: string;
					}> = [];
					const cache = plugin.app.metadataCache;
					const allFiles = plugin.app.vault.getMarkdownFiles();

					let count = 0;
					for (const file of allFiles) {
						if (!isInsideTeam(file.path)) continue;

						const meta = cache.getFileCache(file);
						const hasTag =
							(meta?.tags?.some((t) => t.tag === tag) ||
								Object.keys(meta?.frontmatter || {}).some((key) =>
									`${key}: ${meta?.frontmatter?.[key]}`.includes(tag)
								)) ??
							false;

						if (hasTag) {
							let snippet: string | undefined;
							try {
								const content = await plugin.app.vault.read(file);
								snippet = content.slice(0, snippetLength);
							} catch {}
							results.push({
								path: file.path,
								title: file.basename,
								snippet,
							});
							count++;
							if (count >= k) break;
						}
					}

					if (results.length === 0) {
						return {
							error: {
								code: "no-results",
								message: `No documents found with tag '${tag}'.`,
							},
						};
					}
					return results;
				});
			},
		}),

		get_backlinks: tool({
			description:
				"Get internal Obsidian team docs that link back to the given path, with brief snippets. This tool only works within the team docs folder. For analyzing external backlinks, web references, or broader link analysis, use MCP tools if available. Use to understand team document references and context.",
			inputSchema: z.object({
				path: z.string().describe("Path to get backlinks for"),
				k: z.number().int().min(1).max(20).optional(),
				snippetLength: z.number().int().min(100).max(2000).optional(),
			}),
			execute: async ({
				path,
				k = 5,
				snippetLength = 800,
			}: {
				path: string;
				k?: number;
				snippetLength?: number;
			}) => {
				return withRetry(async () => {
					const cleanPath = cleanAndResolvePath(path, teamRoot);
					if (!isInsideTeam(cleanPath)) {
						return {
							error: {
								code: "outside-sync-folder",
								message: `Path '${cleanPath}' is outside the team docs folder.`,
							},
						};
					}

					const cache = plugin.app.metadataCache;
					const backlinks: Array<{
						path: string;
						title: string;
						snippet?: string;
					}> = [];
					const resolvedLinks = cache.resolvedLinks || {};

					let count = 0;
					for (const [linkingPath, links] of Object.entries(resolvedLinks)) {
						if (links[cleanPath] && isInsideTeam(linkingPath)) {
							const file = plugin.app.vault.getAbstractFileByPath(linkingPath);
							if (file instanceof TFile) {
								let snippet: string | undefined;
								try {
									const content = await plugin.app.vault.read(file);
									snippet = content.slice(0, snippetLength);
								} catch {}
								backlinks.push({
									path: linkingPath,
									title: file.basename,
									snippet,
								});
								count++;
								if (count >= k) break;
							}
						}
					}

					if (backlinks.length === 0) {
						return {
							error: {
								code: "no-backlinks",
								message: `No backlinks found for '${cleanPath}'.`,
							},
						};
					}
					return { path: cleanPath, backlinks };
				});
			},
		}),

		get_graph_context: tool({
			description:
				"Get a simple graph of linked internal Obsidian team docs starting from the given path, up to a maximum depth. This tool only works within the team docs folder. For analyzing external document graphs, web connections, or broader network analysis, use MCP tools if available. Use to visualize team document connections.",
			inputSchema: z.object({
				path: z.string().describe("Starting document path"),
				maxDepth: z
					.number()
					.int()
					.min(1)
					.max(10)
					.optional()
					.describe("Maximum depth to expand (default: 1)"),
				maxNodes: z
					.number()
					.int()
					.min(1)
					.max(100)
					.optional()
					.describe("Maximum nodes to include (default: 20)"),
			}),
			execute: async ({
				path,
				maxDepth = 1,
				maxNodes = 20,
			}: {
				path: string;
				maxDepth?: number;
				maxNodes?: number;
			}) => {
				return withRetry(async () => {
					const cleanPath = cleanAndResolvePath(path, teamRoot);
					if (!isInsideTeam(cleanPath)) {
						return {
							error: {
								code: "outside-sync-folder",
								message: `Path '${cleanPath}' is outside the team docs folder.`,
							},
						};
					}

					const cache = plugin.app.metadataCache;
					const resolvedLinks = cache.resolvedLinks || {};

					const nodes = new Map<string, { id: string; title: string }>();
					const edges: Array<{ from: string; to: string }> = [];
					const visited = new Set<string>();
					const queue: Array<{ path: string; depth: number }> = [
						{ path: cleanPath, depth: 0 },
					];

					while (queue.length > 0 && nodes.size < maxNodes) {
						const { path: current, depth } = queue.shift()!;
						if (depth > maxDepth || visited.has(current)) continue;
						visited.add(current);

						const file = plugin.app.vault.getAbstractFileByPath(current);
						if (file instanceof TFile) {
							nodes.set(current, { id: current, title: file.basename });
						}

						const outgoing = resolvedLinks[current] || {};
						for (const [to, _] of Object.entries(outgoing)) {
							if (isInsideTeam(to) && !visited.has(to)) {
								edges.push({ from: current, to });
								queue.push({ path: to, depth: depth + 1 });
							}
						}
					}

					if (nodes.size === 0) {
						return {
							error: {
								code: "no-graph",
								message: `No graph context found for '${cleanPath}'.`,
							},
						};
					}

					return {
						startingPath: cleanPath,
						nodes: Array.from(nodes.values()),
						edges,
						hasMore: queue.length > 0,
					};
				});
			},
		}),
	} as const;
}
