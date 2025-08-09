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
};
