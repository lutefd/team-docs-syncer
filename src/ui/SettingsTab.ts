import { App, PluginSettingTab, Setting, FileSystemAdapter } from "obsidian";
import TeamDocsPlugin from "../../main";
import { MCPClientConfig, MCP_TRANSPORT_TYPE } from "../types/Settings";

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

		containerEl.createEl("h3", { text: "AI Providers" });

		containerEl.createEl("h4", { text: "OpenAI" });

		new Setting(containerEl)
			.setName("OpenAI API Key")
			.setDesc("Your OpenAI API key. Stored locally in this plugin's settings.")
			.addText((text) =>
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.ai.openaiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.ai.openaiApiKey = value.trim();
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h4", { text: "Anthropic" });

		new Setting(containerEl)
			.setName("Anthropic API Key")
			.setDesc("Your Anthropic API key for Claude models.")
			.addText((text) =>
				text
					.setPlaceholder("sk-ant-...")
					.setValue(this.plugin.settings.ai.anthropicApiKey)
					.onChange(async (value) => {
						this.plugin.settings.ai.anthropicApiKey = value.trim();
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h4", { text: "Ollama" });

		new Setting(containerEl)
			.setName("Ollama Base URL")
			.setDesc("Base URL for your Ollama instance.")
			.addText((text) =>
				text
					.setPlaceholder("http://localhost:11434")
					.setValue(this.plugin.settings.ai.ollamaBaseUrl)
					.onChange(async (value) => {
						this.plugin.settings.ai.ollamaBaseUrl = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Ollama Compose Models")
			.setDesc(
				"Comma-separated list of Ollama models for compose/write modes (with tools)."
			)
			.addText((text) =>
				text
					.setPlaceholder("llama3.2:3b, gemma3:9b")
					.setValue(this.plugin.settings.ai.ollamaComposeModels.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.ai.ollamaComposeModels = value
							.split(",")
							.map((m) => m.trim())
							.filter((m) => m.length > 0);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Ollama Chat Models")
			.setDesc(
				"Comma-separated list of Ollama models for chat mode (without tools)."
			)
			.addText((text) =>
				text
					.setPlaceholder("llama3.2:3b, gemma3:4b")
					.setValue(this.plugin.settings.ai.ollamaChatModels.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.ai.ollamaChatModels = value
							.split(",")
							.map((m) => m.trim())
							.filter((m) => m.length > 0);
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h4", { text: "Google" });

		new Setting(containerEl)
			.setName("Google API Key")
			.setDesc("Your Google AI API key for Gemini models.")
			.addText((text) =>
				text
					.setPlaceholder("AI...")
					.setValue(this.plugin.settings.ai.googleApiKey)
					.onChange(async (value) => {
						this.plugin.settings.ai.googleApiKey = value.trim();
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h4", { text: "Legacy Settings" });

		new Setting(containerEl)
			.setName("Temperature")
			.setDesc("Controls creativity. Lower is more focused (0-2).")
			.addText((text) =>
				text
					.setPlaceholder("0.2")
					.setValue(String(this.plugin.settings.openaiTemperature))
					.onChange(async (value) => {
						const n = Number(value);
						this.plugin.settings.openaiTemperature = isNaN(n) ? 0.2 : n;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Max Tokens")
			.setDesc("Response token cap for the assistant.")
			.addText((text) =>
				text
					.setPlaceholder("4080")
					.setValue(String(this.plugin.settings.openaiMaxTokens))
					.onChange(async (value) => {
						const n = parseInt(value, 10);
						this.plugin.settings.openaiMaxTokens = isNaN(n) ? 4080 : n;
						await this.plugin.saveSettings();
					})
			);

		this.createMCPServersSection(containerEl);
	}

	private createMCPServersSection(containerEl: HTMLElement) {
		containerEl.createEl("h3", { text: "MCP Servers" });
		containerEl.createEl("p", {
			text: "Configure Model Context Protocol servers to extend AI capabilities with external tools and resources.",
			cls: "setting-item-description",
		});

		const mcpContainer = containerEl.createDiv();
		this.safeAddClass(mcpContainer, "mcp-clients-container");

		this.renderMCPClients(mcpContainer);

		new Setting(containerEl)
			.setName("Add MCP Server")
			.setDesc("Add a new MCP server configuration")
			.addButton((button) =>
				button
					.setButtonText("Add Server")
					.setCta()
					.onClick(() => {
						this.addNewMCPClient(mcpContainer);
					})
			);
	}

	private renderMCPClients(container: HTMLElement) {
		container.empty();

		this.plugin.settings.mcpClients.forEach((client, index) => {
			this.renderMCPClient(container, client, index);
		});
	}

	private renderMCPClient(
		container: HTMLElement,
		client: MCPClientConfig,
		index: number
	) {
		const clientContainer = container.createDiv();
		this.safeAddClass(clientContainer, "mcp-client-container");
		clientContainer.style.border =
			"1px solid var(--background-modifier-border)";
		clientContainer.style.borderRadius = "8px";
		clientContainer.style.padding = "16px";
		clientContainer.style.marginBottom = "16px";
		clientContainer.style.backgroundColor = "var(--background-secondary)";

		const headerDiv = clientContainer.createDiv();
		headerDiv.style.display = "flex";
		headerDiv.style.justifyContent = "space-between";
		headerDiv.style.alignItems = "center";
		headerDiv.style.marginBottom = "12px";

		const titleEl = headerDiv.createEl("h4", {
			text: client.name || `MCP Server ${index + 1}`,
		});
		titleEl.style.margin = "0";

		const deleteButton = headerDiv.createEl("button", { text: "Delete" });
		this.safeAddClass(deleteButton, "mod-warning");
		deleteButton.style.fontSize = "12px";
		deleteButton.style.padding = "4px 8px";
		deleteButton.onclick = () => {
			this.deleteMCPClient(index, container);
		};

		new Setting(clientContainer)
			.setName("Enabled")
			.setDesc("Enable this MCP server")
			.addToggle((toggle) =>
				toggle.setValue(client.enabled).onChange(async (value) => {
					this.plugin.settings.mcpClients[index].enabled = value;
					await this.saveSettingsAndRefresh();
				})
			);

		new Setting(clientContainer)
			.setName("Server Name")
			.setDesc("Display name for this MCP server")
			.addText((text) =>
				text
					.setPlaceholder("My MCP Server")
					.setValue(client.name)
					.onChange(async (value) => {
						this.plugin.settings.mcpClients[index].name = value;
						await this.saveSettingsAndRefresh();
						titleEl.textContent = value || `MCP Server ${index + 1}`;
					})
			);

		new Setting(clientContainer)
			.setName("Transport Type")
			.setDesc("How to connect to the MCP server")
			.addDropdown((dropdown) => {
				dropdown
					.addOption(MCP_TRANSPORT_TYPE.STDIO, "STDIO (Local Process)")
					.addOption(MCP_TRANSPORT_TYPE.HTTP, "HTTP (Web Server)")
					.addOption(MCP_TRANSPORT_TYPE.SSE, "SSE (Server-Sent Events)")
					.setValue(client.transport.type)
					.onChange(async (value: MCP_TRANSPORT_TYPE) => {
						this.plugin.settings.mcpClients[index].transport.type = value;
						this.plugin.settings.mcpClients[index].transport.command = "";
						this.plugin.settings.mcpClients[index].transport.args = "";
						this.plugin.settings.mcpClients[index].transport.url = "";

						this.renderTransportFields(
							clientContainer,
							this.plugin.settings.mcpClients[index],
							index
						);

						await this.saveSettingsAndRefresh();
					});
			});

		this.renderTransportFields(clientContainer, client, index);
	}

	private renderTransportFields(
		container: HTMLElement,
		client: MCPClientConfig,
		index: number
	) {
		const existingFields = container.querySelectorAll(".transport-field");
		existingFields.forEach((field) => field.remove());

		switch (client.transport.type) {
			case MCP_TRANSPORT_TYPE.STDIO:
				const commandSetting = new Setting(container)
					.setName("Command")
					.setDesc("Executable command to run the MCP server")
					.addText((text) =>
						text
							.setPlaceholder("node")
							.setValue(client.transport.command || "")
							.onChange(async (value) => {
								this.plugin.settings.mcpClients[index].transport.command =
									value;
								await this.plugin.saveSettings();
							})
					);
				this.safeAddClass(commandSetting.settingEl, "transport-field");
				this.safeAddClass(commandSetting.settingEl, "transport-field-command");

				const argsSetting = new Setting(container)
					.setName("Arguments")
					.setDesc("Command line arguments (space-separated)")
					.addText((text) =>
						text
							.setPlaceholder("/path/to/mcp/server.js")
							.setValue(client.transport.args || "")
							.onChange(async (value) => {
								this.plugin.settings.mcpClients[index].transport.args = value;
								await this.plugin.saveSettings();
							})
					);
				this.safeAddClass(argsSetting.settingEl, "transport-field");
				this.safeAddClass(argsSetting.settingEl, "transport-field-args");
				break;

			case MCP_TRANSPORT_TYPE.HTTP:
			case MCP_TRANSPORT_TYPE.SSE:
				const urlSetting = new Setting(container)
					.setName("Server URL")
					.setDesc("URL of the MCP server")
					.addText((text) =>
						text
							.setPlaceholder("http://localhost:8080/mcp")
							.setValue(client.transport.url || "")
							.onChange(async (value) => {
								this.plugin.settings.mcpClients[index].transport.url = value;
								await this.plugin.saveSettings();
							})
					);
				this.safeAddClass(urlSetting.settingEl, "transport-field");
				this.safeAddClass(urlSetting.settingEl, "transport-field-url");
				break;
		}
	}

	/**
	 * Safely add a CSS class to an element in both Obsidian and Jest DOM.
	 */
	private safeAddClass(el: any, className: string) {
		if (!el) return;
		if (typeof el.addClass === "function") {
			el.addClass(className);
			return;
		}
		if (el.classList && typeof el.classList.add === "function") {
			el.classList.add(className);
		}
	}

	private addNewMCPClient(container: HTMLElement) {
		const newClient: MCPClientConfig = {
			id: `mcp-${Date.now()}`,
			name: "",
			enabled: true,
			transport: {
				type: MCP_TRANSPORT_TYPE.STDIO,
				command: "",
				args: "",
				url: "",
			},
		};

		this.plugin.settings.mcpClients.push(newClient);
		this.saveSettingsAndRefresh();
		this.renderMCPClients(container);
	}

	private async deleteMCPClient(index: number, container: HTMLElement) {
		this.plugin.settings.mcpClients.splice(index, 1);
		await this.saveSettingsAndRefresh();
		this.renderMCPClients(container);
	}

	private async saveSettingsAndRefresh() {
		await this.plugin.saveSettings();
		if (this.plugin.mcpManager) {
			await this.plugin.mcpManager.refreshClients();
		}
	}
}
