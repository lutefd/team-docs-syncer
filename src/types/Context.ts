import type { ModelMessage } from "ai";
import type { AiProvider } from "./AiProvider";
import type { MCPSelection } from "../ui/components/MCPChooser";
import type { Mode } from "../instructions";

export interface MemoryItem {
	id: string;
	type: "fact" | "preference" | "entity";
	content: string;
	source?: string;
	createdAt: number;
	tags?: string[];
}

export interface ContextBuildRequest {
	messages: ModelMessage[];
	mode: Mode;
	provider?: AiProvider;
	modelId?: string;
	aiScope: "team-docs" | "vault-wide";
	teamRoot: string;
	mcpSelection?: MCPSelection;
	sessionId: string;
}

export interface RetrievalPolicy {
	enableVault: boolean;
	k: number;
	snippetLength: number;
}

export interface ContextPolicy {
	maxInputTokens?: number;
	summarizeOverTokens: number;
	historyMaxMessages: number;
	retrieval: RetrievalPolicy;
	includeMCPOverview: boolean;
}

export interface MessageSlice {
	type: "messages";
	messages: ModelMessage[];
}

export interface SummarySlice {
	type: "summary";
	summary: string;
}

export interface DocSlice {
	type: "doc";
	path: string;
	title: string;
	snippet?: string;
}

export interface MCPOverviewSlice {
	type: "mcp-overview";
	clients: Array<{
		clientId: string;
		clientName: string;
		tools: string[];
		authNeeded?: boolean;
	}>;
}

export type ContextSlice =
	| MessageSlice
	| SummarySlice
	| DocSlice
	| MCPOverviewSlice;

export interface ContextBuildResult {
	systemAugment: string;
	trimmedMessages: ModelMessage[];
	summaryText?: string | null;
	metrics: {
		inputTokensEstimated: number;
		prunedTokens: number;
		summarized: boolean;
		retrievalCount: number;
	};
}
