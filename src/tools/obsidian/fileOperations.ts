import { z } from "zod";
import { tool } from "ai";
import { TFile, TFolder } from "obsidian";
import type TeamDocsPlugin from "../../../main";
import { withRetry, cleanAndResolvePath } from "../core/utils";
import { PathUtils } from "src/utils/PathUtils";

export function createFileOperationTools(plugin: TeamDocsPlugin) {
	const teamRoot = plugin.settings.teamDocsPath;
	const isInsideAiScope = (p: string) => PathUtils.isWithinAiScope(p, teamRoot);

	return {
		read_doc: tool({
			description:
				"Read full markdown content for internal Obsidian team docs only. This tool is restricted to team documentation within the configured sync folder. For reading external files, web content, or other document types, use MCP tools if available. ALWAYS read documents before proposing edits to understand current content.",
			inputSchema: z.object({ path: z.string() }),
			execute: async ({ path }: { path: string }) => {
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
					const cleanPath = cleanAndResolvePath(path, teamRoot);

					if (!isInsideAiScope(cleanPath)) {
						return {
							error: {
								code: "outside-sync-folder",
								message: `Path '${cleanPath}' is outside the team docs folder.`,
							},
						};
					}

					if (!content || content.trim().length === 0) {
						return {
							error: {
								code: "no-content-provided",
								message: "Content must be provided for edits.",
							},
						};
					}

					return {
						ok: true,
						path: cleanPath,
						content,
						instructions: instructions || "",
					};
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

					if (!isInsideAiScope(cleanPath)) {
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
					if (!isInsideAiScope(cleanPath)) {
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
	};
}
