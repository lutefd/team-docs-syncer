import TeamDocsPlugin from "../../main";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText, type ModelMessage } from "ai";
import { buildTools } from "../tools/AiTools";
import { AiProviderFactory } from "./AiProviderFactory";
import { AiProvider } from "../types/AiProvider";
import { MCPSelection } from "../ui/MCPChooser";

export type Mode = "compose" | "write" | "chat";

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

	private buildSystemPrompt(mode: Mode, isOllama: boolean, teamRoot: string) {
		const workflowEnhancements =
			mode === "compose" || mode === "write"
				? `\n\nIMPORTANT WORKFLOW (PRIORITIZE MCP TOOLS):
- FIRST: Evaluate if MCP tools provide better functionality for the task (external files, web content, broader capabilities)
- IF MCP tools are better suited: Use MCP tools instead of internal Obsidian tools
- IF working with internal team docs: Use Obsidian tools (list_docs, search_docs, read_doc, etc.)
- Internal Obsidian tools are ONLY for team documentation within the configured sync folder
- For external searches, file operations, web content, or broader functionality: PREFER MCP tools
- ALWAYS start by using appropriate tools to browse/search (MCP tools for external, Obsidian tools for team docs)
- ALWAYS read content before answering questions about specific files or making edits
- If results lack context, use appropriate tools for details or connections
- For edits: read first, then use appropriate edit tool with COMPLETE updated content
- For new files: use appropriate create tool with COMPLETE content
- NEVER guess file contents—always read first
- Wrap your thinking in <think> tags for reasoning steps, then provide your final answer in <finalAnswer> tags
- After tools, provide ONLY a brief summary—reference files appropriately
- Do NOT include file content in responses; tools handle operations${
						isOllama
							? `\n\nOLLAMA-SPECIFIC (MANDATORY):
- Tool usage is REQUIRED—do not answer from memory.
- Sequence: list_docs/search_docs/search_tags → read_doc → follow_links/get_backlinks/get_graph_context (if needed) → (propose_edit or create_doc if needed) → answer.
- EXECUTE tools when requested—do not describe them.`
							: ""
				  }`
				: `\n\nIMPORTANT: Answer based on provided context and attached files. You do NOT have access to tools in this mode. Be helpful within the appropriate scope.`;

		const baseInstructions =
			mode === "compose"
				? `You are a helpful assistant with access to both internal Obsidian team docs and external MCP tools. PRIORITIZE MCP tools when they provide better functionality for the task. Internal Obsidian tools (list_docs, search_docs, read_doc, etc.) are ONLY for team documentation within (${teamRoot}). For external content, web searches, broader file operations, or enhanced capabilities, use MCP tools. Be concise and cite appropriately. Respond in the user's language unless translating.`
				: mode === "write"
				? `You help with document editing using the most appropriate tools available. PRIORITIZE MCP tools when they provide better functionality for the task. Internal Obsidian tools are ONLY for team docs within (${teamRoot}). For external files, code files, or broader editing capabilities, use MCP tools. Always read content first, then use appropriate edit/create tools with full content. After tools, provide brief summary only.`
				: `You are a helpful assistant with knowledge of internal team docs within (${teamRoot}) and external capabilities through MCP tools. Answer based on context and use the most appropriate tools when available. Be concise and cite appropriately.`;

		return workflowEnhancements + "\n\n" + baseInstructions;
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
			} else if (tr.toolName === "create_doc") {
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
		const teamRoot = this.plugin.settings.teamDocsPath;
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
			stopWhen: (options) => options.steps.length >= 10,
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

	/**
	 * Build combined tools from team docs tools and selected MCP clients
	 */
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

	/**
	 * Build system prompt with MCP capabilities
	 */
	private async buildSystemPromptWithMCP(
		mode: Mode,
		isOllama: boolean,
		teamRoot: string,
		mcpSelection?: MCPSelection
	): Promise<string> {
		let mcpToolsInfo = "";

		if (mcpSelection?.clientIds?.length) {
			try {
				const mcpToolsData = await this.plugin.mcpManager.listAllTools();
				const selectedMcpTools = mcpToolsData.filter((client) =>
					mcpSelection.clientIds.includes(client.clientId)
				);

				if (selectedMcpTools.length > 0) {
					const toolsList = selectedMcpTools
						.flatMap((client) => {
							const tools = Array.isArray(client.tools) ? client.tools : [];
							return tools.map((tool) => {
								const sanitizedClientName = client.clientName.replace(
									/[^a-zA-Z0-9_]/g,
									"_"
								);
								const sanitizedToolName = tool.name
									.replace(/[^a-zA-Z0-9_.-]/g, "_")
									.replace(/-/g, "_");
								return `- ${sanitizedClientName}_${sanitizedToolName}: ${tool.description || "No description"}`;
							});
						})
						.join("\n");

					mcpToolsInfo = `\n\nMCP TOOLS AVAILABLE (PRIORITIZE WHEN APPROPRIATE):\n${toolsList}\n\nCRITICAL: Use MCP tools when they provide better functionality than internal Obsidian tools. MCP tools are preferred for:\n- External file operations (outside team docs folder)\n- Web content and searches\n- Code files and broader programming tasks\n- Enhanced capabilities beyond basic markdown operations\n- Any task where MCP tools offer superior functionality\n\nInternal Obsidian tools should ONLY be used for team documentation within the configured sync folder.`;
				}
			} catch (error) {
				console.error("Failed to get MCP tools info:", error);
			}
		}

		return this.buildSystemPrompt(mode, isOllama, teamRoot) + mcpToolsInfo;
	}
}
