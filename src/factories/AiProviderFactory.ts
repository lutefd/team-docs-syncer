import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { LanguageModel, generateText } from "ai";
import { AiProvider, ModelConfig, ProviderConfig } from "../types/AiProvider";

import { TeamDocsSettings } from "../types/Settings";
import { DEFAULT_MODELS } from "src/types/ModelsDescription";

/**
 * Factory service for creating AI provider instances
 */
export class AiProviderFactory {
	constructor(private settings: TeamDocsSettings) {}

	/**
	 * Get available models for a specific provider
	 */
	getAvailableModels(
		provider: AiProvider,
		mode?: "compose" | "write" | "chat"
	): ModelConfig[] {
		switch (provider) {
			case AiProvider.OPENAI:
				return this.settings.ai.openaiApiKey
					? DEFAULT_MODELS[AiProvider.OPENAI]
					: [];

			case AiProvider.ANTHROPIC:
				return this.settings.ai.anthropicApiKey
					? DEFAULT_MODELS[AiProvider.ANTHROPIC]
					: [];

			case AiProvider.OLLAMA:
				let ollamaModels: string[];
				if (mode === "compose" || mode === "write") {
					ollamaModels = this.settings.ai.ollamaComposeModels || [];
				} else if (mode === "chat") {
					ollamaModels = this.settings.ai.ollamaChatModels || [];
				} else {
					ollamaModels = [
						...(this.settings.ai.ollamaComposeModels || []),
						...(this.settings.ai.ollamaChatModels || []),
					];
				}

				const uniqueModels = [...new Set(ollamaModels)];
				return uniqueModels.map((modelId) => ({
					id: modelId,
					name: modelId,
					provider: AiProvider.OLLAMA,
					supportsTools: mode === "compose" || mode === "write",
					supportsStreaming: true,
				}));

			case AiProvider.GOOGLE:
				return this.settings.ai.googleApiKey
					? DEFAULT_MODELS[AiProvider.GOOGLE]
					: [];

			default:
				return [];
		}
	}

	/**
	 * Get all available providers with their models
	 */
	getAvailableProviders(mode?: "compose" | "write" | "chat"): ProviderConfig[] {
		const providers: ProviderConfig[] = [];

		if (this.settings.ai.openaiApiKey) {
			providers.push({
				provider: AiProvider.OPENAI,
				apiKey: this.settings.ai.openaiApiKey,
				models: DEFAULT_MODELS[AiProvider.OPENAI],
			});
		}

		if (this.settings.ai.anthropicApiKey) {
			providers.push({
				provider: AiProvider.ANTHROPIC,
				apiKey: this.settings.ai.anthropicApiKey,
				models: DEFAULT_MODELS[AiProvider.ANTHROPIC],
			});
		}

		if (
			this.settings.ai.ollamaBaseUrl &&
			(this.settings.ai.ollamaComposeModels.length > 0 ||
				this.settings.ai.ollamaChatModels.length > 0)
		) {
			providers.push({
				provider: AiProvider.OLLAMA,
				baseUrl: this.settings.ai.ollamaBaseUrl,
				models: this.getAvailableModels(AiProvider.OLLAMA, mode),
			});
		}

		if (this.settings.ai.googleApiKey) {
			providers.push({
				provider: AiProvider.GOOGLE,
				apiKey: this.settings.ai.googleApiKey,
				models: DEFAULT_MODELS[AiProvider.GOOGLE],
			});
		}

		return providers;
	}

	/**
	 * Create a language model instance for the specified provider and model
	 */
	createModel(provider: AiProvider, modelId: string): LanguageModel {
		switch (provider) {
			case AiProvider.OPENAI:
				return this.createOpenAIModel(modelId);

			case AiProvider.ANTHROPIC:
				return this.createAnthropicModel(modelId);

			case AiProvider.OLLAMA:
				return this.createOllamaModel(modelId);

			case AiProvider.GOOGLE:
				return this.createGoogleModel(modelId);

			default:
				throw new Error(`Unsupported provider: ${provider}`);
		}
	}

	/**
	 * Check if a provider is available (has required configuration)
	 */
	isProviderAvailable(provider: AiProvider): boolean {
		switch (provider) {
			case AiProvider.OPENAI:
				return !!this.settings.ai.openaiApiKey?.trim();

			case AiProvider.ANTHROPIC:
				return !!this.settings.ai.anthropicApiKey?.trim();

			case AiProvider.OLLAMA:
				return (
					!!this.settings.ai.ollamaBaseUrl?.trim() &&
					(this.settings.ai.ollamaChatModels.length > 0 ||
						this.settings.ai.ollamaComposeModels.length > 0)
				);

			case AiProvider.GOOGLE:
				return !!this.settings.ai.googleApiKey?.trim();

			default:
				return false;
		}
	}

	/**
	 * Get the first available provider and model
	 */
	getDefaultProviderAndModel(): {
		provider: AiProvider;
		modelId: string;
	} | null {
		const providers = this.getAvailableProviders();
		if (providers.length === 0) return null;

		const firstProvider = providers[0];
		const firstModel = firstProvider.models[0];

		if (!firstModel) return null;

		return {
			provider: firstProvider.provider,
			modelId: firstModel.id,
		};
	}

	private createOpenAIModel(modelId: string): LanguageModel {
		const apiKey = this.settings.ai.openaiApiKey?.trim();
		if (!apiKey) throw new Error("OpenAI API key not set");

		const provider = createOpenAI({ apiKey });
		return provider(modelId);
	}

	private createAnthropicModel(modelId: string): LanguageModel {
		const apiKey = this.settings.ai.anthropicApiKey?.trim();
		if (!apiKey) throw new Error("Anthropic API key not set");

		const provider = createAnthropic({
			apiKey,
			fetch: async (url: string, options: any) => {
				const { requestUrl } = require("obsidian");

				try {
					const response = await requestUrl({
						url: url.toString(),
						method: options?.method || "GET",
						headers: options?.headers || {},
						body: options?.body,
						contentType:
							options?.headers?.["content-type"] || "application/json",
					});

					const responseObj = {
						ok: response.status >= 200 && response.status < 300,
						status: response.status,
						statusText: response.status.toString(),
						headers: new Map(Object.entries(response.headers || {})),
						json: async () => response.json,
						text: async () => response.text || JSON.stringify(response.json),
						body: response.arrayBuffer
							? new ReadableStream({
									start(controller) {
										controller.enqueue(new Uint8Array(response.arrayBuffer));
										controller.close();
									},
							  })
							: null,
						redirected: false,
						type: "basic" as ResponseType,
						url: url.toString(),
						clone: () => responseObj,
						arrayBuffer: async () => response.arrayBuffer || new ArrayBuffer(0),
						blob: async () =>
							new Blob([response.text || JSON.stringify(response.json)]),
						formData: async () => new FormData(),
						bodyUsed: false,
					};
					return responseObj as unknown as Response;
				} catch (error) {
					console.error("[Anthropic] Request failed:", error);
					throw error;
				}
			},
		});
		return provider(modelId);
	}

	private createOllamaModel(modelId: string): LanguageModel {
		const { createOllama } = require("../services/OllamaProvider");
		const ollamaProvider = createOllama({
			baseURL: this.settings.ai.ollamaBaseUrl || "http://localhost:11434",
		});
		return ollamaProvider(modelId);
	}

	private createGoogleModel(modelId: string): LanguageModel {
		const apiKey = this.settings.ai.googleApiKey?.trim();
		if (!apiKey) throw new Error("Google Generative AI API key not set");

		const provider = createGoogleGenerativeAI({ apiKey });
		return provider(modelId);
	}

	/**
	 * Check if a provider has a valid API key configured
	 */
	hasValidApiKey(provider: AiProvider): boolean {
		switch (provider) {
			case AiProvider.OPENAI:
				return !!this.settings.ai.openaiApiKey?.trim();
			case AiProvider.ANTHROPIC:
				return !!this.settings.ai.anthropicApiKey?.trim();
			case AiProvider.OLLAMA:
				return !!this.settings.ai.ollamaBaseUrl?.trim();
			case AiProvider.GOOGLE:
				return !!this.settings.ai.googleApiKey?.trim();
			default:
				return false;
		}
	}

	/**
	 * Test if a provider is available and properly configured
	 */
	async testProvider(provider: AiProvider, modelId: string): Promise<boolean> {
		if (provider === AiProvider.OLLAMA) {
			return await this.testOllamaConnection();
		}

		try {
			const model = this.createModel(provider, modelId);
			return this.isProviderAvailable(provider);
		} catch (error) {
			console.error(`Provider test failed for ${provider}:`, error);
			return false;
		}
	}

	private async testOllamaConnection(): Promise<boolean> {
		try {
			const response = await fetch(`${this.settings.ai.ollamaBaseUrl}/models`);
			return response.ok;
		} catch (error) {
			return false;
		}
	}
}
