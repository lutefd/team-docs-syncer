import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export interface OllamaProviderSettings {
	baseURL?: string;
	headers?: Record<string, string>;
}

export interface OllamaModelSettings {
	temperature?: number;
	maxTokens?: number;
}

/**
 * Create Ollama provider using OpenAI-compatible interface
 */
function createOllama(options: OllamaProviderSettings = {}) {
	return createOpenAICompatible({
		name: "ollama",
		baseURL: options.baseURL ?? "http://localhost:11434/v1",
		headers: options.headers,
	});
}

export const ollama = createOllama();

export { createOllama };
