import { Plugin } from "obsidian";
import { TeamDocsSettings, DEFAULT_SETTINGS } from "./src/types/Settings";
import { EditReservationManager } from "./src/managers/EditReservationManager";
import { StatusIndicator } from "./src/ui/components/StatusIndicator";
import { GitService } from "./src/services/GitService";
import { FileHandler } from "./src/handlers/FileHandlers";
import { CommandManager } from "./src/managers/CommandManager";
import { UIManager } from "./src/managers/UIManager";
import { TeamDocsSettingTab } from "./src/ui/SettingsTab";
import {
	ACTIVITY_FEED_VIEW,
	TeamActivityFeedView,
} from "./src/ui/TeamActivityFeed";
import { AiService } from "./src/services/AiService";
import { MarkdownIndexService } from "./src/services/MarkdownIndexService";
import { ChatSessionService } from "./src/services/ChatSessionService";
import { CHATBOT_VIEW, ChatbotView } from "./src/ui/ChatbotView";
import { MCPManager } from "./src/managers/MCPManager";
import { PathUtils } from "./src/utils/PathUtils";

/**
 * Main plugin class for Team Docs Git Sync functionality
 */
export default class TeamDocsPlugin extends Plugin {
	settings: TeamDocsSettings;
	reservationManager: EditReservationManager;
	statusIndicator: StatusIndicator;
	gitService: GitService;
	fileHandler: FileHandler;
	commandManager: CommandManager;
	uiManager: UIManager;
	aiService: AiService;
	markdownIndexService: MarkdownIndexService;
	chatSessionService: ChatSessionService;
	mcpManager: MCPManager;
	private syncInterval: ReturnType<typeof setInterval> | null = null;

	async onload() {
		await this.loadSettings();

		PathUtils.setAiScope(this.settings.aiScope);

		this.initializeServices();
		this.setupViews();
		this.setupCommands();
		this.setupEventHandlers();
		this.setupAutoSync();

		this.addSettingTab(new TeamDocsSettingTab(this.app, this));

		if (this.settings.autoSyncOnStartup) {
			setTimeout(() => this.gitService.syncTeamDocs(), 2000);
		}

		setTimeout(() => {
			this.reservationManager.syncReservationsFromGit();
		}, 3000);

		setTimeout(async () => {
			await this.mcpManager.initialize();
		}, 1000);

		console.log("Team Docs Git Sync plugin loaded");
	}

	async onunload() {
		if (this.syncInterval) {
			clearInterval(this.syncInterval);
		}
		this.reservationManager.getMyReservations().forEach(async (res) => {
			await this.reservationManager.releaseReservationByPath(res.filePath);
		});

		if (this.mcpManager) {
			await this.mcpManager.shutdown();
		}

		console.log("Team Docs Git Sync plugin unloaded");
	}

	async loadSettings() {
		const loadedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

		if (!this.settings.ai) {
			this.settings.ai = DEFAULT_SETTINGS.ai;

			if (loadedData?.openaiApiKey) {
				this.settings.ai.openaiApiKey = loadedData.openaiApiKey;
			}
		}

		if (
			loadedData?.ai?.ollamaModels &&
			Array.isArray(loadedData.ai.ollamaModels)
		) {
			const oldModels = loadedData.ai.ollamaModels;

			if (!this.settings.ai.ollamaComposeModels) {
				this.settings.ai.ollamaComposeModels = [];
			}
			if (!this.settings.ai.ollamaChatModels) {
				this.settings.ai.ollamaChatModels = [];
			}

			if (this.settings.ai.ollamaComposeModels.length === 0) {
				this.settings.ai.ollamaComposeModels = [...oldModels];
			}
			if (this.settings.ai.ollamaChatModels.length === 0) {
				this.settings.ai.ollamaChatModels = [...oldModels];
			}

			await this.saveSettings();
		}

		if (!loadedData?.ai) {
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.setupAutoSync();

		PathUtils.setAiScope(this.settings.aiScope);

		if (this.markdownIndexService) {
			await this.markdownIndexService.rebuildIndex();
		}

		if (this.mcpManager) {
			await this.mcpManager.refreshClients();
		}
	}

	private initializeServices() {
		this.gitService = new GitService(this.app, this);
		this.reservationManager = new EditReservationManager(this.app, this);
		this.statusIndicator = new StatusIndicator(this.app, this);
		this.fileHandler = new FileHandler(this.app, this);
		this.commandManager = new CommandManager(this.app, this);
		this.uiManager = new UIManager(this.app, this);

		this.aiService = new AiService(this);
		this.markdownIndexService = new MarkdownIndexService(this.app, this);
		this.chatSessionService = new ChatSessionService();
		this.mcpManager = new MCPManager(this);

		this.addChild(this.reservationManager);
		this.addChild(this.statusIndicator);
	}

	private setupViews() {
		this.registerView(
			ACTIVITY_FEED_VIEW,
			(leaf) => new TeamActivityFeedView(leaf, this)
		);

		this.registerView(CHATBOT_VIEW, (leaf) => new ChatbotView(leaf, this));
	}

	private setupCommands() {
		this.commandManager.registerCommands();
	}

	private setupEventHandlers() {
		this.fileHandler.registerEventHandlers();
	}

	private setupAutoSync() {
		if (this.syncInterval) {
			clearInterval(this.syncInterval);
		}

		if (this.settings.autoSyncInterval > 0) {
			this.syncInterval = setInterval(
				() => this.gitService.syncTeamDocs(),
				this.settings.autoSyncInterval * 60 * 1000
			);
		}
	}
}
