import { App } from "obsidian";
import TeamDocsPlugin from "../../main";

/**
 * Manages plugin commands and ribbon icons
 */
export class CommandManager {
	constructor(private app: App, private plugin: TeamDocsPlugin) {}

	/**
	 * Registers all plugin commands and ribbon icons
	 */
	registerCommands() {
		this.addRibbonIcons();
		this.addCommands();
	}

	private addRibbonIcons() {
		this.plugin.addRibbonIcon("sync", "Sync Team Docs", () => {
			this.plugin.gitService.syncTeamDocs();
		});

		this.plugin.addRibbonIcon("users", "Open Team Activity Feed", () => {
			this.plugin.uiManager.openActivityFeed();
		});
	}

	private addCommands() {
		this.plugin.addCommand({
			id: "sync-team-docs",
			name: "Sync Team Docs",
			callback: () => this.plugin.gitService.syncTeamDocs(),
		});

		this.plugin.addCommand({
			id: "force-pull-team-docs",
			name: "Force Pull Team Docs",
			callback: () => this.plugin.gitService.forcePullTeamDocs(),
		});

		this.plugin.addCommand({
			id: "reserve-file",
			name: "Reserve Current File for Editing",
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (
					activeFile &&
					activeFile.path.startsWith(this.plugin.settings.teamDocsPath + "/")
				) {
					if (!checking) {
						this.plugin.reservationManager.reserveFile(activeFile);
					}
					return true;
				}
				return false;
			},
		});

		this.plugin.addCommand({
			id: "release-file",
			name: "Release Current File Reservation",
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (
					activeFile &&
					activeFile.path.startsWith(this.plugin.settings.teamDocsPath + "/")
				) {
					const reservation = this.plugin.reservationManager.getFileReservation(
						activeFile.path
					);
					if (
						reservation &&
						reservation.userName === this.plugin.settings.userName
					) {
						if (!checking) {
							this.plugin.reservationManager.releaseFile(activeFile);
						}
						return true;
					}
				}
				return false;
			},
		});

		this.plugin.addCommand({
			id: "open-team-activity-feed",
			name: "Open Team Activity Feed",
			callback: () => {
				this.plugin.uiManager.openActivityFeed();
			},
		});
	}
}
