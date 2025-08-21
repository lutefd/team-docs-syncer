import TeamDocsPlugin from "../../main";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText, type ModelMessage } from "ai";
import { buildTools } from "../tools";
import { AiProviderFactory } from "./AiProviderFactory";
import { AiProvider } from "../types/AiProvider";
import { MCPSelection } from "../ui/components/MCPChooser";
import {
	buildSystemPrompt,
	type Mode,
	type MCPToolInfo,
} from "../instructions";
import { PathUtils } from "src/utils/PathUtils";

export interface ChatResult {
	text: string;
	sources: string[];
	proposals?: Array<{ path: string; content: string }>;
	creations?: Array<{ path: string; content: string }>;
	thoughts?: string;
}

export class AiService {
	constructor(private plugin: TeamDocsPlugin) {}

	hasApiKey(provider?: AiProvider): boolean {
		if (!provider) {
			const key = this.plugin.settings.openaiApiKey?.trim();
			return !!key;
		}
		const factory = new AiProviderFactory(this.plugin.settings);
		return factory.hasValidApiKey(provider);
	}

	private getModel(provider?: AiProvider, modelId?: string) {
		if (!provider || !modelId) {
			const apiKey = this.plugin.settings.openaiApiKey?.trim();
			if (!apiKey) throw new Error("OpenAI API key not set");
			const openaiProvider = createOpenAI({ apiKey });
			const modelName = this.plugin.settings.openaiModel || "gpt-4o-mini";
			return openaiProvider(modelName);
		}
		const factory = new AiProviderFactory(this.plugin.settings);
		return factory.createModel(provider, modelId);
	}

	private processToolResults(
		toolResults: any[],
		sources: Set<string>,
		proposals: Array<{ path: string; content: string }>,
		creations: Array<{ path: string; content: string }>
	) {
		for (const tr of toolResults) {
			if (tr.toolName === "search_docs") {
				(tr.output as Array<{ path: string }>)?.forEach((r) =>
					r.path ? sources.add(r.path) : null
				);
			} else if (tr.toolName === "read_doc") {
				const r = tr.output as { path?: string };
				if (r?.path) sources.add(r.path);
			} else if (tr.toolName === "follow_links") {
				const r = tr.output as { followedDocs?: Array<{ path: string }> };
				r.followedDocs?.forEach((doc) => {
					if (doc.path) sources.add(doc.path);
				});
			} else if (tr.toolName === "list_docs") {
				const r = tr.output as { items?: Array<{ path: string }> };
				r.items?.forEach((item) => {
					if (item.path) sources.add(item.path);
				});
			} else if (tr.toolName === "search_tags") {
				(tr.output as Array<{ path: string }>)?.forEach((r) =>
					r.path ? sources.add(r.path) : null
				);
			} else if (tr.toolName === "get_backlinks") {
				const r = tr.output as { backlinks?: Array<{ path: string }> };
				r.backlinks?.forEach((bl) => {
					if (bl.path) sources.add(bl.path);
				});
			} else if (tr.toolName === "get_graph_context") {
				const r = tr.output as { nodes?: Array<{ id: string }> };
				r.nodes?.forEach((node) => {
					if (node.id) sources.add(node.id);
				});
			} else if (tr.toolName === "propose_edit") {
				const r = tr.output as {
					path?: string;
					content?: string;
					ok?: boolean;
				};
				if (r?.ok && r?.path && r?.content) {
					proposals.push({ path: r.path, content: r.content });
				}
			} else if (
				tr.toolName === "create_doc" ||
				tr.toolName === "create_base"
			) {
				const r = tr.output as {
					path?: string;
					content?: string;
					ok?: boolean;
				};
				if (r?.ok && r?.path && r?.content) {
					if (!creations.some((c) => c.path === r.path)) {
						creations.push({ path: r.path, content: r.content });
					}
				}
			} else if (tr.toolName === "search_base_def") {
				sources.add("Obsidian Base Schema");
			}
		}
	}

	async streamChat(
		messages: ModelMessage[],
		mode: Mode,
		onDelta: (delta: string) => void,
		onStatus?: (status: string) => void,
		onThoughts?: (thoughts: string) => void,
		onPlaceholder?: (placeholder: string) => void,
		provider?: AiProvider,
		modelId?: string,
		mcpSelection?: MCPSelection
	): Promise<ChatResult> {
		const model = this.getModel(provider, modelId);
		const temperature = this.plugin.settings.openaiTemperature ?? 0.2;
		const scope = PathUtils.getAiScope();
		const teamRoot =
			scope === "team-docs" ? this.plugin.settings.teamDocsPath : "/";
		const isOllama = provider === "ollama";
		const tools =
			mode === "compose" || mode === "write"
				? await this.buildCombinedTools(mcpSelection)
				: undefined;

		const systemPrompt = await this.buildSystemPromptWithMCP(
			mode,
			isOllama,
			teamRoot,
			mcpSelection
		);
		const boundary: ModelMessage = { role: "system", content: systemPrompt };

		const allToolResults: any[] = [];
		const sources = new Set<string>();
		const proposals: Array<{ path: string; content: string }> = [];
		const creations: Array<{ path: string; content: string }> = [];

		const res = streamText({
			model,
			temperature,
			messages: [boundary, ...messages],
			tools,
			stopWhen: (options) => options.steps.length >= 15,
			onStepFinish: (result) => {
				if (result.toolResults?.length) {
					this.processToolResults(
						result.toolResults,
						sources,
						proposals,
						creations
					);
					allToolResults.push(...result.toolResults);
				}

				if (result.toolCalls?.length && onStatus) {
					const statuses = result.toolCalls
						.map((tc) => {
							const toolName = tc.toolName;
							const statusMap: Record<string, string> = {
								search_docs: "🔍 Searching documents...",
								read_doc: "📖 Reading document...",
								follow_links: "🔗 Following links...",
								propose_edit: "✏️ Writing document...",
								create_doc: "📄 Creating document...",
								list_docs: "📂 Listing documents...",
								search_tags: "🏷️ Searching tags...",
								get_backlinks: "🔙 Getting backlinks...",
								get_graph_context: "🌐 Building graph context...",
								create_base: "📄 Creating base file...",
								search_base_def: "📚 Retrieving base schema...",
							};
							return statusMap[toolName] || `🔧 Using ${toolName}...`;
						})
						.join(" ");
					onStatus(statuses);
				}

				if (result.toolCalls?.length && onThoughts) {
					const thoughtsText = result.toolCalls
						.map((tc) => `\n🔧 Executing ${tc.toolName}...\n`)
						.join("");
					onThoughts(thoughtsText);

					if (onStatus) {
						const syncStatus = result.toolCalls
							.map((tc) => `Executing ${tc.toolName}...`)
							.join(" ");
						onStatus(syncStatus);
					}
				}
			},
		});

		let text = "";
		let thoughts = "";
		let inThinking = false;
		let inFinalAnswer = false;
		let hasStartedContent = false;
		let lastChunkTime = Date.now();

		const checkForStall = () => {
			const now = Date.now();
			if (
				!hasStartedContent &&
				now - lastChunkTime > 1000 &&
				onPlaceholder &&
				!inThinking
			) {
				onPlaceholder("💭 Processing...");
			}
		};

		const stallInterval = setInterval(checkForStall, 500);

		try {
			for await (const chunk of res.textStream) {
				lastChunkTime = Date.now();

				if (chunk.includes("<think>")) {
					inThinking = true;
					if (onPlaceholder) {
						onPlaceholder("💭 Thinking...");
					}
					continue;
				}
				if (chunk.includes("</think>")) {
					inThinking = false;
					continue;
				}
				if (chunk.includes("<finalAnswer>")) {
					inFinalAnswer = true;
					inThinking = false;
					hasStartedContent = true;
					if (onStatus) onStatus("📝 Writing response...");
					if (onPlaceholder) onPlaceholder("");
					continue;
				}
				if (chunk.includes("</finalAnswer>")) {
					inFinalAnswer = false;
					continue;
				}

				if (inThinking) {
					const cleanThinking = chunk
						.replace(/<think>/g, "")
						.replace(/<\/think>/g, "");
					if (cleanThinking) {
						thoughts += cleanThinking;
						if (onThoughts) onThoughts(cleanThinking);
					}
				} else if (inFinalAnswer) {
					const cleanChunk = chunk
						.replace(/<finalAnswer>/g, "")
						.replace(/<\/finalAnswer>/g, "");
					if (cleanChunk) {
						if (!hasStartedContent) {
							hasStartedContent = true;
							if (onPlaceholder) onPlaceholder("");
						}
						text += cleanChunk;
						onDelta(cleanChunk);
					}
				} else if (!inThinking) {
					const cleanChunk = chunk
						.replace(/<think>/g, "")
						.replace(/<\/think>/g, "")
						.replace(/<finalAnswer>/g, "")
						.replace(/<\/finalAnswer>/g, "");
					if (cleanChunk) {
						if (!hasStartedContent) {
							hasStartedContent = true;
							if (onPlaceholder) onPlaceholder("");
						}
						text += cleanChunk;
						onDelta(cleanChunk);
					}
				}
			}
		} finally {
			clearInterval(stallInterval);
		}

		if (!text && allToolResults.length > 0) {
			const toolContext = allToolResults
				.map(
					(tr, i) =>
						`Tool #${i + 1} ${tr.toolName}: ${JSON.stringify(tr.output).slice(
							0,
							2000
						)}`
				)
				.join("\n\n");
			const citations = Array.from(sources).join(", ");
			const fallbackPrompt = `You must now answer directly without tools. Based on:

${
	proposals.length
		? `Proposed ${proposals.length} edit(s). User will review diffs.`
		: ""
}
${creations.length ? `Created ${creations.length} new file(s).` : ""}

Provide a brief natural language summary. Reference files with [[path/to/file.md|filename]]. NO file content, NO JSON.

Citations: ${citations || "(none)"}
Tool outputs: ${toolContext}`;

			const fallbackBoundary: ModelMessage = {
				role: "system",
				content: fallbackPrompt,
			};
			const follow = await generateText({
				model,
				temperature,
				messages: [fallbackBoundary, ...messages],
			});
			text = follow.text || "";
		}

		return {
			text,
			sources: Array.from(sources),
			proposals: proposals.length ? proposals : undefined,
			creations: creations.length ? creations : undefined,
			thoughts: thoughts ? thoughts : undefined,
		};
	}

	private async buildCombinedTools(mcpSelection?: MCPSelection): Promise<any> {
		const baseTools = buildTools(this.plugin);

		if (!mcpSelection?.clientIds?.length) {
			return baseTools;
		}

		try {
			const selectedClients = this.plugin.mcpManager
				.getConnectedClients()
				.filter((client) => mcpSelection.clientIds.includes(client.id));

			for (const client of selectedClients) {
				try {
					const toolSet = await client.client.tools();
					Object.assign(baseTools, toolSet);
				} catch (error) {
					console.error(`Failed to get tools from ${client.name}:`, error);
				}
			}

			return baseTools;
		} catch (error) {
			console.error("Failed to build combined tools:", error);
			return baseTools;
		}
	}

	private async buildSystemPromptWithMCP(
		mode: Mode,
		isOllama: boolean,
		teamRoot: string,
		mcpSelection?: MCPSelection
	): Promise<string> {
		let mcpTools: MCPToolInfo[] = [];

		if (mcpSelection?.clientIds?.length) {
			try {
				const mcpToolsData = await this.plugin.mcpManager.listAllTools();
				mcpTools = mcpToolsData
					.filter((client) => mcpSelection.clientIds.includes(client.clientId))
					.map((client) => ({
						clientId: client.clientId,
						clientName: client.clientName,
						tools: Array.isArray(client.tools) ? client.tools : [],
					}));
			} catch (error) {
				console.error("Failed to get MCP tools info:", error);
			}
		}

		return buildSystemPrompt({
			mode,
			isOllama,
			teamRoot,
			mcpTools,
		});
	}
}
