import { App, PluginSettingTab, Setting, FileSystemAdapter } from "obsidian";
import TeamDocsPlugin from "../../main";

/**
 * Settings tab for configuring the Team Docs plugin
 */
export class TeamDocsSettingTab extends PluginSettingTab {
	plugin: TeamDocsPlugin;

	constructor(app: App, plugin: TeamDocsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Team Docs Git Sync Settings" });

		if (!(this.plugin.app.vault.adapter instanceof FileSystemAdapter)) {
			this.createDesktopWarning(containerEl);
		}

		this.createSettings(containerEl);
	}

	private createDesktopWarning(containerEl: HTMLElement) {
		const warningEl = containerEl.createDiv();
		warningEl.style.backgroundColor = "#ffeaa7";
		warningEl.style.border = "1px solid #fdcb6e";
		warningEl.style.borderRadius = "4px";
		warningEl.style.padding = "10px";
		warningEl.style.marginBottom = "20px";
		warningEl.createEl("strong", { text: "Note: " });
		warningEl.appendText(
			"Git sync is only supported on the desktop version of Obsidian."
		);
	}

	private createSettings(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName("Team Docs Folder")
			.setDesc("Folder name for shared team documents")
			.addText((text) =>
				text
					.setPlaceholder("TeamDocs")
					.setValue(this.plugin.settings.teamDocsPath)
					.onChange(async (value) => {
						this.plugin.settings.teamDocsPath = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Git Remote URL")
			.setDesc("Git repository URL for team docs")
			.addText((text) =>
				text
					.setPlaceholder("https://github.com/user/team-docs.git")
					.setValue(this.plugin.settings.gitRemoteUrl)
					.onChange(async (value) => {
						this.plugin.settings.gitRemoteUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("User Name")
			.setDesc("Your name for Git commits")
			.addText((text) =>
				text
					.setPlaceholder("John Doe")
					.setValue(this.plugin.settings.userName)
					.onChange(async (value) => {
						this.plugin.settings.userName = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("User Email")
			.setDesc("Your email for Git commits")
			.addText((text) =>
				text
					.setPlaceholder("john@example.com")
					.setValue(this.plugin.settings.userEmail)
					.onChange(async (value) => {
						this.plugin.settings.userEmail = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto Sync on Startup")
			.setDesc("Automatically sync when Obsidian starts")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoSyncOnStartup)
					.onChange(async (value) => {
						this.plugin.settings.autoSyncOnStartup = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto Sync Interval")
			.setDesc("Minutes between automatic syncs (0 to disable)")
			.addText((text) =>
				text
					.setPlaceholder("10")
					.setValue(String(this.plugin.settings.autoSyncInterval))
					.onChange(async (value) => {
						this.plugin.settings.autoSyncInterval = parseInt(value) || 0;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Attachments Subdirectory")
			.setDesc(
				"Relative folder under the Team Docs folder for pasted image attachments (e.g., 'assets' or 'media/images')."
			)
			.addText((text) =>
				text
					.setPlaceholder("assets")
					.setValue(this.plugin.settings.attachmentsSubdir)
					.onChange(async (value) => {
						this.plugin.settings.attachmentsSubdir = value.trim();
						await this.plugin.saveSettings();
					})
			);
	}
}
