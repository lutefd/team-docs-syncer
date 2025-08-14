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

	openaiApiKey?: string;
	openaiModel?: string;
	openaiTemperature: number;
	openaiMaxTokens: number;
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

	// Legacy settings (for migration)
	openaiApiKey: "",
	openaiModel: "gpt-4o-mini",
	openaiTemperature: 0.2,
	openaiMaxTokens: 4080,
};
