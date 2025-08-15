import TeamDocsPlugin from "../../main";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText, type ModelMessage } from "ai";
import { buildTools } from "../tools/AiTools";
import { AiProviderFactory } from "./AiProviderFactory";
import { AiProvider } from "../types/AiProvider";

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

	async streamChat(
		messages: ModelMessage[],
		mode: Mode,
		onDelta: (delta: string) => void,
		onStatus?: (status: string) => void,
		onThoughts?: (thoughts: string) => void,
		provider?: AiProvider,
		modelId?: string
	): Promise<{
		text: string;
		sources?: string[];
		proposals?: Array<{ path: string; content: string }>;
		creations?: Array<{ path: string; content: string }>;
		thoughts?: string;
	}> {
		const model = this.getModel(provider, modelId);
		const kTemperature = this.plugin.settings.openaiTemperature ?? 0.2;

		let tools =
			mode === "compose" || mode === "write"
				? buildTools(this.plugin)
				: undefined;

		const baseInstructions =
			mode === "compose"
				? `You are a helpful assistant for Obsidian. You can search, read, and edit files across the entire vault. Use search_docs/read_doc to find information. If users ask about editing files, use propose_edit tool - first read the current content with read_doc, then provide the complete updated content in the propose_edit tool. Be concise and cite files using [[path/to/file.md|filename]] format. Always use the same language the user is talking to you in, unless he/she is asking for a translation and specifies the language.`
				: mode === "write"
				? `You help edit Markdown files anywhere in the Obsidian vault. For edits: 
1. First use read_doc to get current content
2. Generate complete updated content based on the user's request  
3. Use propose_edit with the full updated content
For new files, use create_doc with complete content. IMPORTANT: Do NOT include file content in your responses. After using tools, provide only a brief summary of what was done and reference files using [[path/to/file.md|filename]] format. The tools handle all file operations - your job is just to report what happened.`
				: `You are a helpful assistant for Obsidian. You can access files across the entire vault. Answer questions based on the provided context and attached file contents. Be concise and cite files using [[path/to/file.md|filename]] format. You do NOT have access to tools for searching or editing files.`;

		const isOllama = provider === "ollama";
		const ollamaEnhancements =
			isOllama && (mode === "compose" || mode === "write")
				? `\n\nOLLAMA SPECIFIC INSTRUCTIONS:
- You MUST use the available tools to search and read documents
- NEVER attempt to answer questions about specific files without first using search_docs and read_doc
- ALWAYS start by using search_docs to find relevant documents
- ALWAYS use read_doc to read the full content before making any edits or providing detailed information
- Tool usage is MANDATORY - do not try to answer from memory or assumptions
- Follow this exact sequence: search_docs → read_doc → (propose_edit if editing or create_doc if creating) → provide answer`
				: "";

		const workflowEnhancements =
			mode === "compose" || mode === "write"
				? `\n\nIMPORTANT WORKFLOW:
- ALWAYS search first with search_docs to understand available documents
- ALWAYS read documents with read_doc before making any edits or answering questions about specific files
- If search results don't provide enough context, use read_doc to get full content
- Never guess file contents - always read first
- For reasoning models: wrap your thinking process in <think> tags, then provide your final answer${ollamaEnhancements}`
				: `\n\nIMPORTANT: Answer based on the provided context and any attached file contents. Be helpful and informative while staying within the scope of the team documentation.`;

		const boundary: ModelMessage = {
			role: "system",
			content: baseInstructions + workflowEnhancements,
		};

		const allToolResults: any[] = [];
		const sources = new Set<string>();
		const proposals: Array<{ path: string; content: string }> = [];
		const creations: Array<{ path: string; content: string }> = [];

		const res = streamText({
			model,
			temperature: kTemperature,
			messages: [boundary, ...messages],
			tools: tools,
			stopWhen: (options) => {
				if (options.steps.length >= 10) {
					return true;
				}

				const lastStep = options.steps[options.steps.length - 1];
				if (lastStep && lastStep.toolCalls.length === 0) {
					return true;
				}

				return false;
			},
			onStepFinish: (result) => {
				console.log("[AiService] Step finished:", {
					toolCalls: result.toolCalls?.length || 0,
					toolResults: result.toolResults?.length || 0,
				});

				if (result.toolResults && result.toolResults.length > 0) {
					for (const tr of result.toolResults) {
						console.log(`[AiService] Processing tool result:`, {
							toolName: tr.toolName,
							output: tr.output,
						});

						allToolResults.push(tr);

						if (tr.toolName === "search_docs") {
							const arr = (tr as any).output as
								| Array<{ path: string }>
								| undefined;
							arr?.forEach((r) => r?.path && sources.add(r.path));
						}
						if (tr.toolName === "read_doc") {
							const r = (tr as any).output as { path?: string } | undefined;
							if (r?.path) sources.add(r.path);
						}
						if (tr.toolName === "propose_edit") {
							const r = (tr as any).output as
								| {
										path?: string;
										content?: string;
										instructions?: string;
										ok?: boolean;
								  }
								| undefined;
							console.log("[AiService] propose_edit result:", r);
							if (r?.ok && r?.path && r?.content) {
								proposals.push({ path: r.path, content: r.content });
								console.log("[AiService] Added proposal:", {
									path: r.path,
									contentLength: r.content.length,
									contentPreview: r.content.substring(0, 100) + "...",
								});
							}
						}
						if (tr.toolName === "create_doc") {
							const r = (tr as any).output as
								| { path?: string; content?: string; ok?: boolean }
								| undefined;
							console.log("[AiService] create_doc result:", r);
							if (r?.ok && r?.path && r?.content) {
								const existingCreation = creations.find(
									(c) => c.path === r.path
								);
								if (!existingCreation) {
									creations.push({ path: r.path, content: r.content });
									console.log("[AiService] Added creation:", {
										path: r.path,
										contentLength: r.content.length,
									});
								} else {
									console.log(
										"[AiService] Skipping duplicate creation:",
										r.path
									);
								}
							}
						}
					}
				}

				if (result.toolCalls && result.toolCalls.length > 0) {
					for (const toolCall of result.toolCalls) {
						const toolName = toolCall.toolName;
						console.log("[AiService] Step tool call:", toolName);
						let toolStatus = "";
						if (toolName === "search_docs") {
							toolStatus = "🔍 Searching documents...";
						} else if (toolName === "read_doc") {
							toolStatus = "📖 Reading document...";
						} else if (toolName === "follow_links") {
							toolStatus = "🔗 Following document links...";
						} else if (toolName === "propose_edit") {
							toolStatus = "✏️ Writing document...";
						} else if (toolName === "create_doc") {
							toolStatus = "📄 Creating document...";
						} else {
							toolStatus = "🔧 Using tools...";
						}

						if (onStatus) {
							lastStatus = toolStatus;
							onStatus(lastStatus);
						}

						if (onThoughts) {
							onThoughts(`\n🔧 Executing ${toolName}...\n`);
						}
					}
				}
			},
		});

		let text = "";
		let thoughts = "";
		let counter = 0;
		let hasStartedStreaming = false;
		let inThinkingMode = false;
		let inFinalAnswer = false;
		let lastStatus = "";

		for await (const chunk of res.textStream) {
			if (!hasStartedStreaming) {
				hasStartedStreaming = true;
				lastStatus = "Thinking...";
				if (onStatus) onStatus(lastStatus);
			}

			if (chunk.includes("<think>")) {
				inThinkingMode = true;
			}

			if (chunk.includes("</think>")) {
				inThinkingMode = false;
			}

			if (chunk.includes("<finalAnswer>")) {
				inFinalAnswer = true;
				inThinkingMode = false;
				lastStatus = "📝 Writing response...";
				if (onStatus) onStatus(lastStatus);
			}

			if (chunk.includes("</finalAnswer>")) {
				inFinalAnswer = false;
			}

			if (inThinkingMode) {
				thoughts += chunk;
				if (onThoughts) onThoughts(chunk);
				counter += chunk.length;
				continue;
			}

			if (
				inFinalAnswer ||
				(!inThinkingMode &&
					!chunk.includes("<think>") &&
					!chunk.includes("</think>"))
			) {
				let cleanChunk = chunk
					.replace(/<finalAnswer>/g, "")
					.replace(/<\/finalAnswer>/g, "");

				if (cleanChunk) {
					text += cleanChunk;
					onDelta(cleanChunk);
				}
			}

			counter += chunk.length;
		}
		console.log("[AiService] streamChat: done. total chars=", counter);

		console.log("[AiService] Final counts:", {
			toolResults: allToolResults.length,
			sources: sources.size,
			proposals: proposals.length,
			creations: creations.length,
		});

		if (!text && allToolResults.length > 0) {
			const toolContext = allToolResults
				.map(
					(tr: any, i: number) =>
						`Tool #${i + 1} ${tr.toolName}: ${JSON.stringify(tr.output).slice(
							0,
							6080
						)}`
				)
				.join("\n\n");
			const citations = Array.from(sources).join(", ");
			const followBoundary: ModelMessage = {
				role: "system",
				content: `You must now answer directly without calling any tools. Based on your tool usage:

${
	proposals.length > 0
		? `You proposed ${proposals.length} file edit(s). The user will see diff modals to review and apply changes.`
		: ""
}
${creations.length > 0 ? `You created ${creations.length} new file(s).` : ""}

CRITICAL: Provide a brief summary of what you accomplished. Reference files using [[path/to/file.md|filename]] format. Do NOT include file content in your response. NEVER output JSON or structured data - only provide a natural language summary.

Citations: ${citations || "(none)"}
Tool outputs: ${toolContext}`,
			};
			const follow = await generateText({
				model,
				temperature: kTemperature,
				messages: [followBoundary, ...messages],
			});
			text = follow.text || "";
			console.log("[AiService] fallback answer length=", text.length);
		}

		return {
			text,
			sources: Array.from(sources),
			proposals: proposals.length ? proposals : undefined,
			creations: creations.length ? creations : undefined,
			thoughts: thoughts.length > 0 ? thoughts : undefined,
		};
	}
}
