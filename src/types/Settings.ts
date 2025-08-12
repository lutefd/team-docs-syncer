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
	openaiApiKey: string;
	openaiModel: string;
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
	openaiApiKey: "",
	openaiModel: "gpt-5-mini",
	openaiTemperature: 0.2,
	openaiMaxTokens: 4080,
};
