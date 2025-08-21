import { z } from "zod";
import { tool } from "ai";
import type TeamDocsPlugin from "../../../main";
import { withRetry, cleanAndResolvePath } from "../core/utils";
import { PathUtils } from "src/utils/PathUtils";

export function createBasesOperationTools(plugin: TeamDocsPlugin) {
	const teamRoot = plugin.settings.teamDocsPath;
	const isInsideAiScope = (p: string) => PathUtils.isWithinAiScope(p, teamRoot);

	return {
		create_base: tool({
			description:
				"Create a new Obsidian base file (.base) for building custom views, filters, and formulas. The content must be a valid YAML string conforming to the Obsidian Bases schema. Use this to create structured data views from vault files.",
			inputSchema: z.object({
				path: z
					.string()
					.refine((p) => p.endsWith(".base"), {
						message: "Path must end with .base",
					})
					.describe(
						"Full path including the .base under the appropriate folder"
					),
				content: z
					.string()
					.describe(
						"Complete YAML content for the base file, including filters, formulas, properties, and views."
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
								code: "outside-ai-scope",
								message: `Path '${cleanPath}' is outside the AI scope.`,
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

		search_base_def: tool({
			description:
				"Get the schema and documentation for Obsidian's .base file format. Use this to understand the required structure, including filters, formulas, properties, and views, before creating a .base file.",
			inputSchema: z.object({}),
			execute: async () => {
				return withRetry(async () => {
					return {
						overview:
							"Obsidian Bases are saved as .base files. They define filters, formulas, properties, and views using valid YAML.",
						example:
							'filters:\n  or:\n    - file.hasTag("tag")\n    - and:\n        - file.hasTag("book")\n        - file.hasLink("Textbook")\n    - not:\n        - file.hasTag("book")\n        - file.inFolder("Required Reading")\nformulas:\n  formatted_price: \'if(price, price.toFixed(2) + " dollars")\'\n  ppu: "(price / age).toFixed(2)"\nproperties:\n  status:\n    displayName: Status\n  formula.formatted_price:\n    displayName: "Price"\n  file.ext:\n    displayName: Extension\nviews:\n  - type: table\n    name: "My table"\n    limit: 10\n    filters:\n      and:\n        - \'status != "done"\'\n        - or:\n            - "formula.ppu > 5"\n            - "price > 2.1"\n    order:\n      - file.name\n      - file.ext\n      - note.age\n      - formula.ppu\n      - formula.formatted_price\n',
						schema: {
							filters: {
								description:
									"Optional at global level and/or per view. Either a single string expression or an object with 'and', 'or', or 'not' keys; values are lists of strings or nested filter objects.",
								example: {
									or: [
										"file.hasTag('tag')",
										{
											and: ["file.hasTag('book')", "file.hasLink('Textbook')"],
										},
										{ not: ["file.inFolder('Archive')"] },
									],
								},
							},
							formulas: {
								description:
									"Map of formulaName -> expression string. May reference note.*, file.*, or formula.* (no circular refs).",
								example: {
									formatted_price:
										"'if(price, price.toFixed(2) + \" dollars\")'",
									ppu: "(price / age).toFixed(2)",
								},
							},
							properties: {
								description:
									"Display/config metadata per property (e.g., displayName). Not used in expressions; used by views for presentation.",
								example: {
									status: { displayName: "Status" },
									"formula.formatted_price": { displayName: "Price" },
									"file.ext": { displayName: "Extension" },
								},
							},
							views: {
								description:
									"Array of views. Each view: { type, name, limit?, filters?, order?, ...viewSpecificState }",
								example: [
									{
										type: "table",
										name: "My table",
										limit: 10,
										filters: {
											and: [
												"status != 'done'",
												{ or: ["formula.ppu > 5", "price > 2.1"] },
											],
										},
										order: [
											"file.name",
											"file.ext",
											"note.age",
											"formula.ppu",
											"formula.formatted_price",
										],
									},
								],
							},
						},
						propertyTypes: {
							note: "Frontmatter properties (note.price or note['price']); default scope if no prefix is used.",
							file: "File metadata and functions (file.size, file.ext, file.hasLink(), file.path, file.mtime, etc.).",
							formula:
								"Other formulas defined in this base (e.g., formula.formatted_price).",
						},
						fileProperties: [
							{
								name: "file.backlinks",
								type: "List",
								description:
									"Backlink files (performance heavy; prefer reversing lookup with file.links).",
							},
							{ name: "file.ctime", type: "Date", description: "Created time" },
							{
								name: "file.embeds",
								type: "List",
								description: "All embeds in the note",
							},
							{
								name: "file.ext",
								type: "String",
								description: "File extension",
							},
							{
								name: "file.file",
								type: "File",
								description: "File object (usable in specific functions)",
							},
							{
								name: "file.folder",
								type: "String",
								description: "Folder path",
							},
							{
								name: "file.links",
								type: "List",
								description: "All internal links (including frontmatter)",
							},
							{
								name: "file.mtime",
								type: "Date",
								description: "Modified time",
							},
							{ name: "file.name", type: "String", description: "File name" },
							{ name: "file.path", type: "String", description: "File path" },
							{
								name: "file.properties",
								type: "Object",
								description:
									"All properties on the file (may not auto-refresh)",
							},
							{ name: "file.size", type: "Number", description: "File size" },
							{
								name: "file.tags",
								type: "List",
								description: "All tags in content and frontmatter",
							},
						],
						operators: {
							arithmetic: ["+", "-", "*", "/", "%", "( )"],
							dateArithmetic: {
								description:
									"Dates can be offset by durations with + or -. Units: y/year, M/month, d/day, w/week, h/hour, m/minute, s/second.",
								examples: [
									"now() + '1 day'",
									"file.mtime > now() - '1 week'",
									"date('2024-12-01') + '1M' + '4h' + '3m'",
								],
							},
							comparison: ["==", "!=", ">", "<", ">=", "<="],
							boolean: ["!", "&&", "||"],
						},
						types: {
							primitives:
								"Strings ('text'), numbers (1, 2.5), booleans (true/false).",
							dates:
								"Create with date('YYYY-MM-DD HH:mm:ss'), use now()/today(), format with datetime.format('YYYY-MM-DD').",
							objectsAndLists:
								"Use list(x) to ensure list type; access with [index]; object props via dot or ['prop'].",
						},
						filesAndLinks: {
							description:
								"Wikilinks in frontmatter become Link objects; use link('filename', 'display'), file.asLink(). Links can be compared and checked in lists.",
							examples: [
								"link('filename')",
								"link('https://obsidian.md')",
								"authors.contains(this)",
							],
						},
						embedding: {
							description:
								"Bases can be embedded in any markdown file or sidebar context.",
							methods: [
								{
									type: "File Embed",
									syntax: "![[File.base]] or ![[File.base#ViewName]]",
									description:
										"Embed entire base file; optionally specify a default view with #ViewName.",
								},
								{
									type: "Code Block Embed",
									syntax:
										"base code block with YAML (no triple-backticks here to avoid confusion)",
									description:
										"Embed a base directly using a 'base' fenced block in the note.",
								},
							],
						},
						usage: {
							guidance: [
								"Assemble valid YAML with filters, formulas, properties, and views.",
								"Call create_base with a .base path and the full YAML content.",
								"To use in notes, embed with ![[path/to/file.base]] or ![[path/to/file.base#ViewName]], or insert a 'base' code block with YAML.",
							],
						},
					};
				});
			},
		}),
	} as const;
}
