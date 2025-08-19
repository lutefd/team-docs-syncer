import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import TeamDocsPlugin from "../../main";
import { PathUtils } from "../utils/PathUtils";

export const ACTIVITY_FEED_VIEW = "team-activity-feed";

/**
 * Represents an activity item in the team activity feed
 */
export interface ActivityItem {
	id: string;
	type: "commit" | "reservation" | "conflict" | "sync";
	user: string;
	message: string;
	filePath?: string;
	timestamp: number;
	details?: any;
}

/**
 * View component for displaying team activity feed
 */
export class TeamActivityFeedView extends ItemView {
	private plugin: TeamDocsPlugin;
	private activities: ActivityItem[] = [];
	private refreshInterval: ReturnType<typeof setInterval> | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TeamDocsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return ACTIVITY_FEED_VIEW;
	}

	getDisplayText(): string {
		return "Team Activity";
	}

	getIcon(): string {
		return "users";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("team-activity-feed");

		const header = container.createEl("div", { cls: "activity-feed-header" });
		header.createEl("h3", { text: "Team Activity Feed" });

		const refreshButton = header.createEl("button", {
			text: "↻ Refresh",
			cls: "activity-refresh-btn",
		});
		refreshButton.onclick = () => this.refreshActivities();

		const activityList = container.createEl("div", { cls: "activity-list" });
		this.renderActivities(activityList);

		this.refreshInterval = setInterval(() => {
			this.refreshActivities();
		}, 30 * 1000);

		await this.refreshActivities();
	}

	async onClose(): Promise<void> {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval);
		}
	}

	/**
	 * Refreshes activities from Git and updates the display
	 */
	async refreshActivities(): Promise<void> {
		try {
			const newActivities = await this.fetchActivitiesFromGit();
			this.activities = newActivities;

			const activityList = this.containerEl.querySelector(".activity-list");
			if (activityList) {
				this.renderActivities(activityList as HTMLElement);
			}
		} catch (error) {
			console.error("Failed to refresh activities:", error);
		}
	}

	/**
	 * Fetches activities from Git commit history
	 */
	private async fetchActivitiesFromGit(): Promise<ActivityItem[]> {
		const activities: ActivityItem[] = [];

		try {
			const teamDocsPath = await this.plugin.gitService.getTeamDocsPath();
			if (!teamDocsPath) return activities;

			const { stdout } = await this.plugin.gitService.gitCommand(
				teamDocsPath,
				'log --oneline --pretty=format:"%h|%an|%s|%ai" -50'
			);
			const lines = stdout.split("\n").filter((line) => line.trim());

			for (const line of lines) {
				const [hash, author, message, timestamp] = line.split("|");
				if (!hash || !author || !message || !timestamp) continue;

				const activity = this.parseActivityFromCommit(
					hash,
					author,
					message,
					timestamp
				);
				if (activity) {
					activities.push(activity);
				}
			}

			activities.sort((a, b) => b.timestamp - a.timestamp);

			return activities.slice(0, 100);
		} catch (error) {
			console.error("Error fetching activities from git:", error);
			return activities;
		}
	}

	/**
	 * Parses an activity item from a Git commit
	 */
	private parseActivityFromCommit(
		hash: string,
		author: string,
		message: string,
		timestamp: string
	): ActivityItem | null {
		const activityTimestamp = new Date(timestamp).getTime();

		if (message.includes("[RESERVE]")) {
			const match = message.match(/\[RESERVE\] (.+) - ([^-]+) - (.+)/);
			const gitPath = match ? match[1] : "unknown file";
			const relativePath = PathUtils.cleanGitPath(
				gitPath,
				this.plugin.settings.teamDocsPath
			);
			const fileName = PathUtils.getFileName(relativePath);
			return {
				id: hash,
				type: "reservation",
				user: author,
				message: `Reserved ${fileName} for editing`,
				filePath: relativePath,
				timestamp: activityTimestamp,
			};
		}

		if (message.includes("[RELEASE]")) {
			const match = message.match(/\[RELEASE\] (.+) - ([^-]+) - (.+)/);
			const gitPath = match ? match[1] : "unknown file";
			const relativePath = PathUtils.cleanGitPath(
				gitPath,
				this.plugin.settings.teamDocsPath
			);
			const fileName = PathUtils.getFileName(relativePath);
			return {
				id: hash,
				type: "reservation",
				user: author,
				message: `Released ${fileName}`,
				filePath: relativePath,
				timestamp: activityTimestamp,
			};
		}

		if (message.startsWith("Auto-save:")) {
			const match = message.match(/Auto-save: (.+?) by/);
			const fileName = match ? match[1] : "unknown file";
			return {
				id: hash,
				type: "commit",
				user: author,
				message: `Auto-saved ${fileName}`,
				timestamp: activityTimestamp,
			};
		}

		if (message.startsWith("Sync:") || message.includes("Updates by")) {
			return {
				id: hash,
				type: "sync",
				user: author,
				message: "Synced team docs",
				timestamp: activityTimestamp,
			};
		}

		if (message.includes("Resolve conflict")) {
			return {
				id: hash,
				type: "conflict",
				user: author,
				message: "Resolved merge conflict",
				timestamp: activityTimestamp,
			};
		}

		return {
			id: hash,
			type: "commit",
			user: author,
			message: message.length > 60 ? message.substring(0, 60) + "..." : message,
			timestamp: activityTimestamp,
		};
	}

	/**
	 * Renders the activities list in the UI
	 */
	private renderActivities(container: HTMLElement): void {
		container.empty();

		if (this.activities.length === 0) {
			container.createEl("div", {
				text: "No recent team activity",
				cls: "activity-empty",
			});
			return;
		}

		for (const activity of this.activities) {
			const activityEl = container.createEl("div", { cls: "activity-item" });
			activityEl.addClass(`activity-${activity.type}`);

			const icon = this.getActivityIcon(activity.type);
			const iconEl = activityEl.createEl("span", { cls: "activity-icon" });
			iconEl.textContent = icon;

			const contentEl = activityEl.createEl("div", { cls: "activity-content" });

			const messageEl = contentEl.createEl("div", { cls: "activity-message" });
			messageEl.textContent = activity.message;

			const metaEl = contentEl.createEl("div", { cls: "activity-meta" });
			metaEl.textContent = `${activity.user} • ${this.formatTimestamp(
				activity.timestamp
			)}`;

			if (activity.filePath) {
				const fileLinkEl = contentEl.createEl("div", { cls: "activity-file" });
				const fileName = PathUtils.getFileName(activity.filePath);
				const link = fileLinkEl.createEl("a", {
					text: fileName,
					cls: "internal-link",
				});
				link.onclick = () => this.openFile(activity.filePath!);
			}
		}
	}

	/**
	 * Gets the appropriate icon for an activity type
	 */
	private getActivityIcon(type: string): string {
		switch (type) {
			case "commit":
				return "📝";
			case "reservation":
				return "🔒";
			case "conflict":
				return "⚠️";
			case "sync":
				return "🔄";
			default:
				return "•";
		}
	}

	/**
	 * Formats a timestamp for display
	 */
	private formatTimestamp(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;

		const minutes = Math.floor(diff / (1000 * 60));
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (minutes < 1) return "just now";
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;

		return new Date(timestamp).toLocaleDateString();
	}

	/**
	 * Opens a file in the workspace
	 */
	private async openFile(relativePath: string): Promise<void> {
		const teamDocsPath = this.plugin.settings.teamDocsPath;
		const vaultPath = `${teamDocsPath}/${relativePath}`;

		console.log("TeamActivityFeed openFile debug:");
		console.log("  relativePath:", relativePath);
		console.log("  teamDocsPath:", teamDocsPath);
		console.log("  constructed vaultPath:", vaultPath);

		const file = this.app.vault.getAbstractFileByPath(vaultPath);
		console.log("  file found:", !!file);

		if (file) {
			await this.app.workspace.openLinkText(vaultPath, "", false);
		} else {
			const fileName = PathUtils.getFileName(relativePath);
			new Notice(`File "${fileName}" not found in your local team docs folder`);
		}
	}

	/**
	 * Adds a new activity to the feed
	 */
	addActivity(activity: ActivityItem): void {
		this.activities.unshift(activity);
		this.activities = this.activities.slice(0, 100);

		const activityList = this.containerEl.querySelector(".activity-list");
		if (activityList) {
			this.renderActivities(activityList as HTMLElement);
		}
	}
}
