import {
	LanguageModelV2,
	LanguageModelV2CallOptions,
	LanguageModelV2StreamPart,
	LanguageModelV2Content,
	LanguageModelV2Prompt,
	ProviderV2,
} from "@ai-sdk/provider";
import { generateId, withoutTrailingSlash } from "@ai-sdk/provider-utils";

interface OllamaMessage {
	role: string;
	content: string;
}

interface OllamaRequest {
	model: string;
	messages: OllamaMessage[];
	stream: boolean;
	tools?: any[];
	options?: {
		temperature?: number;
		max_tokens?: number;
	};
}

interface OllamaResponse {
	message?: {
		role: string;
		content: string;
		tool_calls?: any[];
	};
	response?: string;
	done: boolean;
	total_duration?: number;
	load_duration?: number;
	prompt_eval_count?: number;
	eval_count?: number;
}

interface OllamaProviderSettings {
	baseURL?: string;
	headers?: Record<string, string>;
}

interface OllamaModelSettings {
	temperature?: number;
	maxTokens?: number;
}
interface OllamaConfig {
	provider: string;
	baseURL: string;
	headers: () => Record<string, string>;
	generateId: () => string;
}

/**
 * Ollama Language Model V2 Implementation
 */
class OllamaLanguageModel implements LanguageModelV2 {
	readonly specificationVersion = "v2" as const;
	readonly provider: string;
	readonly modelId: string;
	readonly supportedUrls: Record<string, RegExp[]> = {};

	private config: OllamaConfig;
	private settings: OllamaModelSettings;

	constructor(
		modelId: string,
		settings: OllamaModelSettings,
		config: OllamaConfig
	) {
		this.provider = config.provider;
		this.modelId = modelId;
		this.config = config;
		this.settings = settings;
	}

	private convertToOllamaMessages(
		prompt: LanguageModelV2Prompt
	): OllamaMessage[] {
		return prompt.map((message) => {
			switch (message.role) {
				case "system":
					return { role: "system", content: message.content };

				case "user":
					const userContent = message.content
						.map((part) => {
							if (part.type === "text") {
								return part.text;
							} else if (part.type === "file") {
								return `[File: ${part.filename || "unknown"}]`;
							}
							return "";
						})
						.join("\n");
					return { role: "user", content: userContent };

				case "assistant":
					const assistantContent = message.content
						.map((part) => {
							if (part.type === "text") {
								return part.text;
							} else if (part.type === "tool-call") {
								return `[Tool Call: ${part.toolName}(${JSON.stringify(
									part.input
								)})]`;
							}
							return "";
						})
						.join("\n");
					return { role: "assistant", content: assistantContent };

				case "tool":
					const toolContent = message.content
						.map((part) => `Tool Result: ${JSON.stringify(part.output)}`)
						.join("\n");
					return { role: "user", content: toolContent };

				default:
					throw new Error(`Unsupported message role: ${(message as any).role}`);
			}
		});
	}

	private getArgs(options: LanguageModelV2CallOptions) {
		const messages = this.convertToOllamaMessages(options.prompt);

		const body: OllamaRequest = {
			model: this.modelId,
			messages,
			stream: false,
			options: {
				temperature: options.temperature ?? this.settings.temperature,
				max_tokens: options.maxOutputTokens ?? this.settings.maxTokens,
			},
		};

		if (options.tools && options.tools.length > 0) {
			body.tools = options.tools.map((tool) => {
				if (tool.type === "function") {
					return {
						type: "function",
						function: {
							name: tool.name,
							description: tool.description,
							parameters: (tool as any).parameters || tool.inputSchema,
						},
					};
				}
				return tool;
			});
		}

		return { args: body, warnings: [] };
	}

	async doGenerate(options: LanguageModelV2CallOptions) {
		const { args, warnings } = this.getArgs(options);

		try {
			const response = await fetch(`${this.config.baseURL}/api/chat`, {
				method: "POST",
				headers: {
					...this.config.headers(),
					"Content-Type": "application/json",
				},
				body: JSON.stringify(args),
				signal: options.abortSignal,
			});

			if (!response.ok) {
				throw new Error(
					`Ollama API error: ${response.status} ${response.statusText}`
				);
			}

			const data: OllamaResponse = await response.json();

			const content: LanguageModelV2Content[] = [];

			if (data.message?.content) {
				content.push({
					type: "text",
					text: data.message.content,
				});
			}

			if (data.message?.tool_calls) {
				for (const toolCall of data.message.tool_calls) {
					content.push({
						type: "tool-call",
						toolCallId: toolCall.id || this.config.generateId(),
						toolName: toolCall.function?.name || "",
						input: toolCall.function?.arguments || {},
					});
				}
			}

			return {
				content,
				finishReason: (data.done ? "stop" : "length") as
					| "stop"
					| "length"
					| "content-filter"
					| "tool-calls"
					| "error"
					| "other",
				usage: {
					inputTokens: data.prompt_eval_count,
					outputTokens: data.eval_count,
					totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
				},
				request: { body: args },
				response: { body: data },
				warnings,
			};
		} catch (error) {
			throw new Error(
				`Failed to generate with Ollama: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	async doStream(options: LanguageModelV2CallOptions) {
		const { args, warnings } = this.getArgs(options);

		const response = await fetch(`${this.config.baseURL}/api/chat`, {
			method: "POST",
			headers: {
				...this.config.headers(),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ ...args, stream: true }),
			signal: options.abortSignal,
		});

		if (!response.ok) {
			throw new Error(
				`Ollama API error: ${response.status} ${response.statusText}`
			);
		}

		if (!response.body) {
			throw new Error("No response body from Ollama");
		}

		let isFirstChunk = true;

		const stream = response.body
			.pipeThrough(new TextDecoderStream())
			.pipeThrough(
				new TransformStream<string, LanguageModelV2StreamPart>({
					transform(chunk, controller) {
						if (isFirstChunk) {
							controller.enqueue({ type: "stream-start", warnings });
							isFirstChunk = false;
						}

						const lines = chunk.split("\n").filter((line) => line.trim());

						for (const line of lines) {
							try {
								const data: OllamaResponse = JSON.parse(line);

								if (data.message?.content) {
									controller.enqueue({
										type: "text-delta",
										id: generateId(),
										delta: data.message.content,
									});
								}

								if (data.message?.tool_calls) {
									for (const toolCall of data.message.tool_calls) {
										controller.enqueue({
											type: "tool-call",
											toolCallId: toolCall.id || generateId(),
											toolName: toolCall.function?.name || "",
											input: toolCall.function?.arguments || {},
										});
									}
								}

								if (data.done) {
									controller.enqueue({
										type: "finish",
										finishReason: "stop" as const,
										usage: {
											inputTokens: data.prompt_eval_count,
											outputTokens: data.eval_count,
											totalTokens:
												(data.prompt_eval_count || 0) + (data.eval_count || 0),
										},
									});
								}
							} catch (parseError) {
								console.warn("Failed to parse Ollama response line:", line);
							}
						}
					},
				})
			);

		return { stream, warnings };
	}
}

/**
 * Ollama Provider V2 Interface
 */
interface OllamaProvider extends ProviderV2 {
	(modelId: string, settings?: OllamaModelSettings): OllamaLanguageModel;
	languageModel(
		modelId: string,
		settings?: OllamaModelSettings
	): OllamaLanguageModel;
}

/**
 * Create Ollama provider instance
 */
function createOllama(options: OllamaProviderSettings = {}): OllamaProvider {
	const createLanguageModel = (
		modelId: string,
		settings: OllamaModelSettings = {}
	) =>
		new OllamaLanguageModel(modelId, settings, {
			provider: "ollama",
			baseURL:
				withoutTrailingSlash(options.baseURL) ?? "http://localhost:11434",
			headers: () => ({
				...options.headers,
			}),
			generateId: generateId,
		});

	const provider = function (modelId: string, settings?: OllamaModelSettings) {
		if (new.target) {
			throw new Error(
				"The model factory function cannot be called with the new keyword."
			);
		}

		return createLanguageModel(modelId, settings);
	};

	provider.languageModel = createLanguageModel;

	return provider as OllamaProvider;
}

export const ollama = createOllama();

export { createOllama };

export type { OllamaProviderSettings, OllamaModelSettings };
