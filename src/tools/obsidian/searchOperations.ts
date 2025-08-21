import { z } from "zod";
import { tool } from "ai";
import { TFile } from "obsidian";
import type TeamDocsPlugin from "../../../main";
import { PathUtils } from "../../utils/PathUtils";
import { withRetry, cleanAndResolvePath } from "../core/utils";

export function createSearchOperationTools(plugin: TeamDocsPlugin) {
	const teamRoot = plugin.settings.teamDocsPath;
	const isInsideAiScope = (p: string) => PathUtils.isWithinAiScope(p, teamRoot);

	return {
		search_docs: tool({
			description:
				"Generic discovery for internal Obsidian docs by title/frontmatter; returns brief snippets. Use within AI scope only. NOTE: For 'similar to <file>' queries, prefer find_similar_to_doc (single seed) or find_similar_to_many (multiple seeds). If no seed is known, you may use search_docs to locate one, then use search_similar.",
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
						if (!isInsideAiScope(file.path)) continue;

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

		search_similar: tool({
			description:
				"Similarity search across internal Obsidian docs using tag overlap + content relevance + index hits. Use when you have a topic/tags but not a specific seed file. Returns ranked results (paths, titles, snippets) AND a Base YAML to render related content. Prefer this over search_docs for similarity when seed unknown. NOTE: The Base YAML uses broad tag filters only; avoid restrictive path equality filters unless the user explicitly asks to narrow.",
			inputSchema: z.object({
				query: z
					.string()
					.describe("Free text to match in content/title/frontmatter"),
				tags: z
					.array(z.string())
					.optional()
					.describe("List of tags to prioritize (with or without #)"),
				k: z.number().int().min(1).max(20).optional(),
				snippetLength: z.number().int().min(80).max(2000).optional(),
			}),
			execute: async ({
				query,
				tags = [],
				k = 8,
				snippetLength = 400,
			}: {
				query: string;
				tags?: string[];
				k?: number;
				snippetLength?: number;
			}) => {
				return withRetry(async () => {
					const cache = plugin.app.metadataCache;
					const allFiles = plugin.app.vault.getMarkdownFiles();
					const normTag = (t: string) => t.replace(/^#/, "").toLowerCase();
					const wantedTags = new Set(tags.map(normTag));
					const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

					const candidates = new Map<
						string,
						{
							file: TFile;
							score: number;
							matchedTags: string[];
							matchedTerms: string[];
							snippet?: string;
						}
					>();

					if (wantedTags.size > 0) {
						for (const file of allFiles) {
							if (!isInsideAiScope(file.path)) continue;
							const meta = cache.getFileCache(file);
							const fileTags = new Set(
								(meta?.tags || []).map((t) => normTag(t.tag || ""))
							);
							const matched: string[] = [];
							for (const wt of wantedTags)
								if (fileTags.has(wt)) matched.push(wt);
							if (matched.length > 0) {
								const key = file.path;
								const prev = candidates.get(key);
								const tagScore = matched.length * 5;
								candidates.set(key, {
									file,
									score: (prev?.score || 0) + tagScore,
									matchedTags: Array.from(
										new Set([...(prev?.matchedTags || []), ...matched])
									),
									matchedTerms: prev?.matchedTerms || [],
									snippet: prev?.snippet,
								});
							}
						}
					}

					if (plugin.markdownIndexService && terms.length > 0) {
						const hits = plugin.markdownIndexService.search(
							query,
							Math.max(20, k * 3)
						);
						for (const h of hits) {
							const abs = plugin.app.vault.getAbstractFileByPath(h.path);
							if (abs instanceof TFile && isInsideAiScope(abs.path)) {
								const prev = candidates.get(abs.path);
								candidates.set(abs.path, {
									file: abs,
									score: (prev?.score || 0) + 3,
									matchedTags: prev?.matchedTags || [],
									matchedTerms: prev?.matchedTerms || [],
									snippet: prev?.snippet,
								});
							}
						}
					}

					if (candidates.size === 0) {
						for (const file of allFiles.slice(0, 200)) {
							if (!isInsideAiScope(file.path)) continue;
							candidates.set(file.path, {
								file,
								score: 0,
								matchedTags: [],
								matchedTerms: [],
							});
						}
					}

					const escapeRegex = (s: string) =>
						s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
					for (const c of candidates.values()) {
						try {
							const content = await plugin.app.vault.read(c.file);
							const lc = content.toLowerCase();
							let contentScore = 0;
							const matchedTerms: string[] = [];
							for (const t of terms) {
								if (!t) continue;
								const re = new RegExp(`\\b${escapeRegex(t)}\\b`, "g");
								const matches = lc.match(re);
								const count = matches ? matches.length : 0;
								if (count > 0) matchedTerms.push(t);
								contentScore += count * 2;
							}
							c.score += contentScore;
							c.matchedTerms = Array.from(
								new Set([...(c.matchedTerms || []), ...matchedTerms])
							);
							c.snippet = content.slice(0, snippetLength);
						} catch {}
					}

					const ranked = Array.from(candidates.values())
						.filter((c) => c.score > 0)
						.sort((a, b) => b.score - a.score)
						.slice(0, k);

					if (ranked.length === 0) {
						return {
							error: {
								code: "no-results",
								message: "No similar documents found for the given query/tags.",
							},
						};
					}

					const results = ranked.map((c) => ({
						path: c.file.path,
						title: c.file.basename,
						tags: Array.from(new Set(c.matchedTags)).map((t) => `#${t}`),
						matchedTerms: c.matchedTerms,
						score: c.score,
						snippet: c.snippet,
					}));

					const tagFilters = Array.from(wantedTags)
						.map((t) => `  - \"file.hasTag('${t}')\"`)
						.join("\n");
					const orFilters = tagFilters;
					const baseYaml = `filters:\n  or:\n${orFilters}\nviews:\n  - type: table\n    name: \"Related Content\"\n    limit: ${k}\n    order:\n      - file.mtime\n      - file.path\n`;

					return {
						results,
						base: {
							yaml: baseYaml,
							description:
								"Embed it in a 'base' code block to render the related items.",
						},
					};
				});
			},
		}),

		find_similar_to_doc: tool({
			description:
				"Best for 'similar to <file>' queries. Extracts tags/title from the seed markdown, searches by tags + content + index, excludes the seed, and returns ranked results AND a ready-to-embed Base YAML. NOTE: The Base YAML uses broad tag filters only; avoid restrictive path equality filters unless the user explicitly asks to narrow.",
			inputSchema: z.object({
				path: z
					.string()
					.describe(
						"Path or wikilink of the seed markdown file (e.g., 'Docs/Note.md' or '[[Note]]')"
					),
				k: z.number().int().min(1).max(20).optional(),
				snippetLength: z.number().int().min(80).max(2000).optional(),
			}),
			execute: async ({
				path,
				k = 8,
				snippetLength = 400,
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
								code: "outside-ai-scope",
								message: `Path '${cleanPath}' is outside the AI scope`,
							},
						};
					}

					const abs = plugin.app.vault.getAbstractFileByPath(cleanPath);
					if (!(abs instanceof TFile)) {
						return {
							error: {
								code: "not-found",
								message: `File not found: ${cleanPath}`,
							},
						};
					}
					if (abs.extension !== "md") {
						return {
							error: {
								code: "not-markdown",
								message: `Only markdown files are supported; got .${abs.extension}`,
							},
						};
					}

					const cache = plugin.app.metadataCache.getFileCache(abs);
					const normTag = (t: string) => t.replace(/^#/, "").toLowerCase();
					const tagSet = new Set<string>();
					for (const t of cache?.tags || []) {
						if (t?.tag) tagSet.add(normTag(t.tag));
					}
					const fm = (cache?.frontmatter as any) || {};
					const fmTags = fm?.tags;
					if (typeof fmTags === "string") {
						for (const part of fmTags.split(/[\s,]+/))
							if (part) tagSet.add(normTag(part));
					} else if (Array.isArray(fmTags)) {
						for (const part of fmTags)
							if (typeof part === "string") tagSet.add(normTag(part));
					}

					const title = (fm?.title as string) || abs.basename;
					const fmForQuery = { ...fm };
					delete fmForQuery["tags"];
					const fmStr = JSON.stringify(fmForQuery || {});
					const query = `${title} ${fmStr.slice(0, 200)}`.trim();

					const allFiles = plugin.app.vault.getMarkdownFiles();
					const wantedTags = new Set(tagSet);
					const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
					const candidates = new Map<
						string,
						{
							file: TFile;
							score: number;
							matchedTags: string[];
							matchedTerms: string[];
							snippet?: string;
						}
					>();

					if (wantedTags.size > 0) {
						for (const file of allFiles) {
							if (!isInsideAiScope(file.path)) continue;
							if (file.path === abs.path) continue;
							const m = plugin.app.metadataCache.getFileCache(file);
							const fileTags = new Set(
								(m?.tags || []).map((x) => normTag(x.tag || ""))
							);
							const matched: string[] = [];
							for (const wt of wantedTags)
								if (fileTags.has(wt)) matched.push(wt);
							if (matched.length > 0) {
								const prev = candidates.get(file.path);
								const tagScore = matched.length * 5;
								candidates.set(file.path, {
									file,
									score: (prev?.score || 0) + tagScore,
									matchedTags: Array.from(
										new Set([...(prev?.matchedTags || []), ...matched])
									),
									matchedTerms: prev?.matchedTerms || [],
									snippet: prev?.snippet,
								});
							}
						}
					}

					if (plugin.markdownIndexService && terms.length > 0) {
						const hits = plugin.markdownIndexService.search(
							query,
							Math.max(20, k * 3)
						);
						for (const h of hits) {
							const f = plugin.app.vault.getAbstractFileByPath(h.path);
							if (
								f instanceof TFile &&
								isInsideAiScope(f.path) &&
								f.path !== abs.path
							) {
								const prev = candidates.get(f.path);
								candidates.set(f.path, {
									file: f,
									score: (prev?.score || 0) + 3,
									matchedTags: prev?.matchedTags || [],
									matchedTerms: prev?.matchedTerms || [],
									snippet: prev?.snippet,
								});
							}
						}
					}

					if (candidates.size === 0) {
						for (const file of allFiles.slice(0, 200)) {
							if (!isInsideAiScope(file.path)) continue;
							if (file.path === abs.path) continue;
							candidates.set(file.path, {
								file,
								score: 0,
								matchedTags: [],
								matchedTerms: [],
							});
						}
					}

					const escapeRegex = (s: string) =>
						s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
					for (const c of candidates.values()) {
						try {
							const content = await plugin.app.vault.read(c.file);
							const lc = content.toLowerCase();
							let contentScore = 0;
							const matchedTerms: string[] = [];
							for (const t of terms) {
								if (!t) continue;
								const re = new RegExp(`\\b${escapeRegex(t)}\\b`, "g");
								const matches = lc.match(re);
								const count = matches ? matches.length : 0;
								if (count > 0) matchedTerms.push(t);
								contentScore += count * 2;
							}
							c.score += contentScore;
							c.matchedTerms = Array.from(
								new Set([...(c.matchedTerms || []), ...matchedTerms])
							);
							c.snippet = content.slice(0, snippetLength);
						} catch {}
					}

					const ranked = Array.from(candidates.values())
						.filter((c) => c.score > 0)
						.sort((a, b) => b.score - a.score)
						.slice(0, k);

					if (ranked.length === 0) {
						return {
							error: {
								code: "no-results",
								message: "No similar documents found for the selected file.",
							},
						};
					}

					const results = ranked.map((c) => ({
						path: c.file.path,
						title: c.file.basename,
						tags: Array.from(new Set(c.matchedTags)).map((t) => `#${t}`),
						matchedTerms: c.matchedTerms,
						score: c.score,
						snippet: c.snippet,
					}));

					const tagFilters = Array.from(wantedTags)
						.map((t) => `  - \"file.hasTag('${t}')\"`)
						.join("\n");
					const baseYaml = `filters:\n  or:\n${tagFilters}\nviews:\n  - type: table\n    name: \"Related to ${title.replace(
						/"/g,
						'\\"'
					)}\"\n    limit: ${k}\n    order:\n      - file.mtime\n      - file.path\n`;

					return {
						seed: {
							path: abs.path,
							title,
							tags: Array.from(tagSet).map((t) => `#${t}`),
							query,
						},
						results,
						base: {
							yaml: baseYaml,
							description:
								"Embed it in a 'base' code block to render the related items.",
						},
					};
				});
			},
		}),
		find_similar_to_many: tool({
			description:
				"Find documents similar to multiple seed markdown files. Aggregates tags and titles/frontmatter from all seeds, searches by combined tags + content + index, excludes all seeds, and returns ranked results with a Base YAML for rendering. NOTE: The Base YAML uses broad tag filters only; avoid restrictive path equality 'where' filters unless the user explicitly asks to narrow.",
			inputSchema: z.object({
				paths: z
					.array(z.string())
					.min(1)
					.describe(
						"List of seed paths or wikilinks (e.g., ['[[Note A]]', 'Docs/NoteB.md'])"
					),
				k: z.number().int().min(1).max(30).optional(),
				snippetLength: z.number().int().min(80).max(2000).optional(),
			}),
			execute: async ({
				paths,
				k = 10,
				snippetLength = 400,
			}: {
				paths: string[];
				k?: number;
				snippetLength?: number;
			}) => {
				return withRetry(async () => {
					const seeds: TFile[] = [];
					const seedTitles: string[] = [];
					const seedPaths = new Set<string>();
					const tagSet = new Set<string>();
					const normTag = (t: string) => t.replace(/^#/, "").toLowerCase();
					for (const p of paths) {
						const cleanPath = cleanAndResolvePath(p, teamRoot);
						if (!isInsideAiScope(cleanPath)) continue;
						const abs = plugin.app.vault.getAbstractFileByPath(cleanPath);
						if (!(abs instanceof TFile) || abs.extension !== "md") continue;
						seeds.push(abs);
						seedPaths.add(abs.path);
						const cache = plugin.app.metadataCache.getFileCache(abs);
						const fm = (cache?.frontmatter as any) || {};
						const title = (fm?.title as string) || abs.basename;
						seedTitles.push(title);
						for (const t of cache?.tags || [])
							if (t?.tag) tagSet.add(normTag(t.tag));
						const fmTags = fm?.tags;
						if (typeof fmTags === "string") {
							for (const part of fmTags.split(/[\s,]+/))
								if (part) tagSet.add(normTag(part));
						} else if (Array.isArray(fmTags)) {
							for (const part of fmTags)
								if (typeof part === "string") tagSet.add(normTag(part));
						}
					}

					if (seeds.length === 0) {
						return {
							error: {
								code: "no-seeds",
								message: "No valid seed markdown files within AI scope.",
							},
						};
					}

					const allFiles = plugin.app.vault.getMarkdownFiles();
					const wantedTags = new Set(tagSet);
					const combinedQuery = seedTitles.join(" ");
					const terms = combinedQuery
						.toLowerCase()
						.split(/\s+/)
						.filter(Boolean);
					const candidates = new Map<
						string,
						{
							file: TFile;
							score: number;
							matchedTags: string[];
							matchedTerms: string[];
							snippet?: string;
						}
					>();

					if (wantedTags.size > 0) {
						for (const file of allFiles) {
							if (!isInsideAiScope(file.path)) continue;
							if (seedPaths.has(file.path)) continue;
							const m = plugin.app.metadataCache.getFileCache(file);
							const fileTags = new Set(
								(m?.tags || []).map((x) => normTag(x.tag || ""))
							);
							const matched: string[] = [];
							for (const wt of wantedTags)
								if (fileTags.has(wt)) matched.push(wt);
							if (matched.length > 0) {
								const prev = candidates.get(file.path);
								const tagScore = matched.length * 5;
								candidates.set(file.path, {
									file,
									score: (prev?.score || 0) + tagScore,
									matchedTags: Array.from(
										new Set([...(prev?.matchedTags || []), ...matched])
									),
									matchedTerms: prev?.matchedTerms || [],
									snippet: prev?.snippet,
								});
							}
						}
					}

					if (plugin.markdownIndexService && terms.length > 0) {
						const hits = plugin.markdownIndexService.search(
							combinedQuery,
							Math.max(30, k * 3)
						);
						for (const h of hits) {
							const f = plugin.app.vault.getAbstractFileByPath(h.path);
							if (
								f instanceof TFile &&
								isInsideAiScope(f.path) &&
								!seedPaths.has(f.path)
							) {
								const prev = candidates.get(f.path);
								candidates.set(f.path, {
									file: f,
									score: (prev?.score || 0) + 3,
									matchedTags: prev?.matchedTags || [],
									matchedTerms: prev?.matchedTerms || [],
									snippet: prev?.snippet,
								});
							}
						}
					}

					if (candidates.size === 0) {
						for (const file of allFiles.slice(0, 300)) {
							if (!isInsideAiScope(file.path)) continue;
							if (seedPaths.has(file.path)) continue;
							candidates.set(file.path, {
								file,
								score: 0,
								matchedTags: [],
								matchedTerms: [],
							});
						}
					}

					const escapeRegex = (s: string) =>
						s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
					for (const c of candidates.values()) {
						try {
							const content = await plugin.app.vault.read(c.file);
							const lc = content.toLowerCase();
							let contentScore = 0;
							const matchedTerms: string[] = [];
							for (const t of terms) {
								if (!t) continue;
								const re = new RegExp(`\\b${escapeRegex(t)}\\b`, "g");
								const matches = lc.match(re);
								const count = matches ? matches.length : 0;
								if (count > 0) matchedTerms.push(t);
								contentScore += count * 2;
							}
							c.score += contentScore;
							c.matchedTerms = Array.from(
								new Set([...(c.matchedTerms || []), ...matchedTerms])
							);
							c.snippet = content.slice(0, snippetLength);
						} catch {}
					}

					const ranked = Array.from(candidates.values())
						.filter((c) => c.score > 0)
						.sort((a, b) => b.score - a.score)
						.slice(0, k);

					if (ranked.length === 0) {
						return {
							error: {
								code: "no-results",
								message: "No similar documents found for the selected seeds.",
							},
						};
					}

					const results = ranked.map((c) => ({
						path: c.file.path,
						title: c.file.basename,
						tags: Array.from(new Set(c.matchedTags)).map((t) => `#${t}`),
						matchedTerms: c.matchedTerms,
						score: c.score,
						snippet: c.snippet,
					}));

					const tagFilters = Array.from(wantedTags)
						.map((t) => `  - \"file.hasTag('${t}')\"`)
						.join("\n");
					const baseYaml = `filters:\n  or:\n${tagFilters}\nviews:\n  - type: table\n    name: \"Related to ${seeds.length} seeds\"\n    limit: ${k}\n    order:\n      - file.mtime\n      - file.path\n`;

					return {
						seeds: seeds.map((s) => ({ path: s.path, title: s.basename })),
						results,
						base: {
							yaml: baseYaml,
							description:
								"Embed it in a 'base' code block to render the related items.",
						},
					};
				});
			},
		}),
	};
}
