import TeamDocsPlugin from "../../main";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText, type ModelMessage } from "ai";
import { buildTools } from "../tools/AiTools";

export type Mode = "chat" | "write";

export interface ChatResult {
	text: string;
	sources: string[];
	proposals?: Array<{ path: string; content: string }>;
	creations?: Array<{ path: string; content: string }>;
}

export class AiService {
	constructor(private plugin: TeamDocsPlugin) {}

	hasApiKey(): boolean {
		const key = this.plugin.settings.openaiApiKey?.trim();
		return !!key;
	}

	private getModel() {
		const apiKey = this.plugin.settings.openaiApiKey?.trim();
		if (!apiKey) throw new Error("OpenAI API key not set");
		const provider = createOpenAI({ apiKey });
		const modelName = this.plugin.settings.openaiModel || "gpt-5-mini";
		return provider(modelName);
	}

	async streamChat(
		messages: ModelMessage[],
		mode: Mode,
		onDelta: (delta: string) => void,
		onStatus?: (status: string) => void
	): Promise<{
		text: string;
		sources?: string[];
		proposals?: Array<{ path: string; content: string }>;
		creations?: Array<{ path: string; content: string }>;
	}> {
		const model = this.getModel();
		const kTemperature = this.plugin.settings.openaiTemperature ?? 0.2;
		const teamRoot = this.plugin.settings.teamDocsPath;
		const tools = buildTools(this.plugin);

		const boundary: ModelMessage = {
			role: "system",
			content:
				mode === "chat"
					? `You are a helpful assistant for Obsidian Team Docs. Only discuss files within the team sync folder (${teamRoot}). Use search_docs/read_doc to find information. If users ask about editing files, use propose_edit tool - first read the current content with read_doc, then provide the complete updated content in the propose_edit tool. Be concise and cite files using [[path/to/file.md|filename]] format.`
					: `You help edit Markdown files strictly inside (${teamRoot}). For edits: 
1. First use read_doc to get current content
2. Generate complete updated content based on the user's request  
3. Use propose_edit with the full updated content
For new files, use create_doc with complete content. IMPORTANT: Do NOT include file content in your responses. After using tools, provide only a brief summary of what was done and reference files using [[path/to/file.md|filename]] format. The tools handle all file operations - your job is just to report what happened.`,
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
								creations.push({ path: r.path, content: r.content });
								console.log("[AiService] Added creation:", {
									path: r.path,
									contentLength: r.content.length,
								});
							}
						}
					}
				}

				if (result.toolCalls && result.toolCalls.length > 0 && onStatus) {
					for (const toolCall of result.toolCalls) {
						const toolName = toolCall.toolName;
						console.log("[AiService] Step tool call:", toolName);
						if (toolName === "search_docs") {
							onStatus("🔍 Searching documents...");
						} else if (toolName === "read_doc") {
							onStatus("📖 Reading document...");
						} else if (toolName === "follow_links") {
							onStatus("🔗 Following document links...");
						} else if (toolName === "propose_edit") {
							onStatus("✏️ Writing document...");
						} else if (toolName === "create_doc") {
							onStatus("📄 Creating document...");
						} else {
							onStatus("🔧 Using tools...");
						}
					}
				}
			},
		});

		let text = "";
		let counter = 0;
		let hasStartedStreaming = false;

		for await (const chunk of res.textStream) {
			if (!hasStartedStreaming) {
				hasStartedStreaming = true;
				if (onStatus) onStatus("📝 Generating response...");
			}
			text += chunk;
			counter += chunk.length;
			onDelta(chunk);
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

Provide a brief summary of what you did. Reference files using [[path/to/file.md|filename]] format. Do NOT include file content in your response.

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
		};
	}
}
