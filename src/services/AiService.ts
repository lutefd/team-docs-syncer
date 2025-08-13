import TeamDocsPlugin from "../../main";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText, type ModelMessage } from "ai";
import { buildTools } from "../tools/AiTools";

export type Mode = "chat" | "write";

export interface ChatResult {
	text: string;
	sources: string[];
	proposals?: Array<{ path: string; content: string }>;
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
	}> {
		const model = this.getModel();
		const kTemperature = this.plugin.settings.openaiTemperature ?? 0.2;
		const teamRoot = this.plugin.settings.teamDocsPath;
		const tools = buildTools(this.plugin);

		const boundary: ModelMessage = {
			role: "system",
			content:
				mode === "chat"
					? `You are a helpful assistant for Obsidian Team Docs. Only discuss files within the team sync folder (${teamRoot}). Prefer citing files by path. Use tools search_docs/read_doc to ground answers. Be concise.`
					: `You help edit Markdown files strictly inside (${teamRoot}). Suggest minimal, safe changes. Use propose_edit to indicate which file to update; then output ONLY the full updated Markdown content in your final answer for that file. Do not touch files outside the folder.`,
		};

		const res = streamText({
			model,
			temperature: kTemperature,
			messages,
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

		const sources = new Set<string>();
		const proposals: Array<{ path: string; content: string }> = [];
		const trArr = (await res.toolResults) as any[] | undefined;
		console.log("[AiService] toolResults count=", trArr?.length || 0);
		for (const tr of trArr ?? []) {
			if (tr.toolName === "search_docs") {
				const arr = (tr as any).output as Array<{ path: string }> | undefined;
				arr?.forEach((r) => r?.path && sources.add(r.path));
			}
			if (tr.toolName === "read_doc") {
				const r = (tr as any).output as { path?: string } | undefined;
				if (r?.path) sources.add(r.path);
			}
			if (tr.toolName === "propose_edit") {
				const r = (tr as any).output as { path?: string } | undefined;
				if (r?.path && text.trim().length > 0) {
					proposals.push({ path: r.path, content: text });
				}
			}
		}

		if (!text && (trArr?.length || 0) > 0) {
			const toolContext = (trArr || [])
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
				content: `You must now answer directly without calling any tools. Use the tool outputs below and keep the answer concise. If applicable, cite these file paths: ${
					citations || "(none)"
				}. If write mode, output ONLY a message saying you finished or if had any problems you encountered along with the link to the edited file following the pattern [[path/to/file.md|filename]].\n\n${toolContext}`,
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
		};
	}

	async chat(messages: ModelMessage[], mode: Mode): Promise<ChatResult> {
		const model = this.getModel();
		const kTemperature = this.plugin.settings.openaiTemperature ?? 0.2;

		const teamRoot = this.plugin.settings.teamDocsPath;
		const tools = buildTools(this.plugin);

		const boundary: ModelMessage = {
			role: "system",
			content:
				mode === "chat"
					? `You are a helpful assistant for Obsidian Team Docs. Only discuss files within the team sync folder (${teamRoot}). Prefer citing files by path. Use tools search_docs/read_doc to ground answers. Be concise.`
					: `You help edit Markdown files strictly inside (${teamRoot}). Suggest minimal, safe changes. Use propose_edit to indicate which file to update; then output ONLY the full updated Markdown content in your final answer for that file. Do not touch files outside the folder.`,
		};

		const result = await generateText({
			model,
			temperature: kTemperature,
			messages: [boundary, ...messages],
			tools,
		});

		const text = result.text || "";

		const sources = new Set<string>();
		const proposals: Array<{ path: string; content: string }> = [];

		for (const tr of result.toolResults ?? []) {
			if (tr.toolName === "search_docs") {
				const arr = (tr as any).output as Array<{ path: string }> | undefined;
				arr?.forEach((r) => r?.path && sources.add(r.path));
			}
			if (tr.toolName === "read_doc") {
				const r = (tr as any).output as { path?: string } | undefined;
				if (r?.path) sources.add(r.path);
			}
			if (tr.toolName === "propose_edit") {
				const r = (tr as any).output as { path?: string } | undefined;
				if (r?.path && text.trim().length > 0) {
					proposals.push({ path: r.path, content: text });
				}
			}
		}

		return {
			text,
			sources: Array.from(sources),
			proposals: proposals.length ? proposals : undefined,
		};
	}
}
