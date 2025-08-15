/**
 * AI Provider types and interfaces for multi-provider support
 */

export enum AiProvider {
	OPENAI = "openai",
	ANTHROPIC = "anthropic",
	OLLAMA = "ollama",
	GOOGLE = "google",
}

export interface ModelConfig {
	id: string;
	name: string;
	provider: AiProvider;
	maxTokens?: number;
	supportsTools?: boolean;
	supportsStreaming?: boolean;
}

export interface ProviderConfig {
	provider: AiProvider;
	apiKey?: string;
	baseUrl?: string;
	models: ModelConfig[];
}

export interface AiProviderSettings {
	openaiApiKey: string;

	anthropicApiKey: string;

	ollamaBaseUrl: string;
	ollamaComposeModels: string[];
	ollamaChatModels: string[];

	googleApiKey: string;

	lastUsedProvider?: AiProvider;
	lastUsedModel?: string;
	lastUsedMode?: "chat" | "compose" | "write";
}

export interface ChatSession {
	id: string;
	provider: AiProvider;
	modelId: string;
	messages: any[];
	createdAt: Date;
	updatedAt: Date;
}

export const DEFAULT_AI_PROVIDER_SETTINGS: AiProviderSettings = {
	openaiApiKey: "",
	anthropicApiKey: "",
	ollamaBaseUrl: "http://localhost:11434",
	ollamaComposeModels: [],
	ollamaChatModels: [],
	googleApiKey: "",
};
