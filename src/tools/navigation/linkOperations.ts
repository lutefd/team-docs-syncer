import { z } from "zod";
import { tool } from "ai";
import { TFile } from "obsidian";
import type TeamDocsPlugin from "../../../main";
import { PathUtils } from "../../utils/PathUtils";
import { withRetry, cleanAndResolvePath } from "../core/utils";

export function createLinkOperationTools(plugin: TeamDocsPlugin) {
	const teamRoot = plugin.settings.teamDocsPath;
	const isInsideAiScope = (p: string) => PathUtils.isWithinAiScope(p, teamRoot);

	return {
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

						if (!PathUtils.isWithinTeamDocs(linkPath, teamRoot)) {
							const currentDir = path.substring(0, path.lastIndexOf("/"));
							const resolvedPath = currentDir + "/" + linkPath;
							linkPath = PathUtils.isWithinTeamDocs(resolvedPath, teamRoot)
								? resolvedPath
								: teamRoot + "/" + linkPath;
						}

						if (
							isInsideAiScope(linkPath) &&
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
					if (!isInsideAiScope(cleanPath)) {
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
						if (links[cleanPath] && isInsideAiScope(linkingPath)) {
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
					if (!isInsideAiScope(cleanPath)) {
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
							if (isInsideAiScope(to) && !visited.has(to)) {
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
	};
}
