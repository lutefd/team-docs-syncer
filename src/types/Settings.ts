import { AiProviderSettings, DEFAULT_AI_PROVIDER_SETTINGS } from "./AiProvider";

/**
 * Plugin configuration interface
 */
export interface TeamDocsSettings {
	teamDocsPath: string;
	gitRemoteUrl: string;
	autoSyncOnStartup: boolean;
	autoSyncInterval: number;
	userName: string;
	userEmail: string;
	conflictResolutionMode: "manual" | "auto-theirs" | "auto-mine";
	attachmentsSubdir: string;

	ai: AiProviderSettings;
	mcpClients: MCPClientConfig[];

	aiScope: "team-docs" | "vault-wide";

	openaiApiKey?: string;
	openaiModel?: string;
	openaiTemperature: number;
	openaiMaxTokens: number;
}

/**
 * MCP transport types
 */
export enum MCP_TRANSPORT_TYPE {
	STDIO = "stdio",
	HTTP = "streamable-http",
	SSE = "sse",
}

/**
 * MCP client configuration interface
 */
export interface MCPClientConfig {
	id: string;
	name: string;
	enabled: boolean;
	transport: {
		type: MCP_TRANSPORT_TYPE;
		command?: string;
		args?: string;
		url?: string;
	};
}

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: TeamDocsSettings = {
	teamDocsPath: "TeamDocs",
	gitRemoteUrl: "",
	autoSyncOnStartup: true,
	autoSyncInterval: 5,
	userName: "",
	userEmail: "",
	conflictResolutionMode: "manual",
	attachmentsSubdir: "attachments",

	ai: DEFAULT_AI_PROVIDER_SETTINGS,
	mcpClients: [],

	aiScope: "team-docs",

	// Legacy settings (for migration)
	openaiApiKey: "",
	openaiModel: "gpt-4o-mini",
	openaiTemperature: 0.2,
	openaiMaxTokens: 4080,
};
