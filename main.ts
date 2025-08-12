import { Plugin } from "obsidian";
import { TeamDocsSettings, DEFAULT_SETTINGS } from "./src/types/Settings";
import { EditReservationManager } from "./src/managers/EditReservationManager";
import { StatusIndicator } from "./src/ui/StatusIndicator";
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
	private syncInterval: ReturnType<typeof setInterval> | null = null;

	async onload() {
		await this.loadSettings();

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

		console.log("Team Docs Git Sync plugin loaded");
	}

	onunload() {
		if (this.syncInterval) {
			clearInterval(this.syncInterval);
		}
		this.reservationManager.getMyReservations().forEach(async (res) => {
			await this.reservationManager.releaseReservationByPath(res.filePath);
		});
		console.log("Team Docs Git Sync plugin unloaded");
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.setupAutoSync();
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
