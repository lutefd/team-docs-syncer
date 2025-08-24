import { App, Component } from "obsidian";
import TeamDocsPlugin from "../../../main";

/**
 * Represents the current synchronization status
 */
export interface SyncStatus {
	status: "synced" | "syncing" | "conflict" | "offline" | "error";
	message: string;
	timestamp: number;
}

/**
 * Manages the status indicator in the status bar
 */
export class StatusIndicator extends Component {
	private app: App;
	private plugin: TeamDocsPlugin;
	private statusBarItem: HTMLElement | null = null;
	private currentStatus: SyncStatus;
	private statusTooltip: HTMLElement | null = null;

	constructor(app: App, plugin: TeamDocsPlugin) {
		super();
		this.app = app;
		this.plugin = plugin;
		this.currentStatus = {
			status: "offline",
			message: "Not initialized",
			timestamp: Date.now(),
		};
	}

	onload(): void {
		this.statusBarItem = this.plugin.addStatusBarItem();
		this.statusBarItem.addClass("team-docs-status");
		this.statusBarItem.onclick = () => this.showStatusDetails();

		this.updateStatusDisplay();

		this.registerInterval(
			window.setInterval(() => this.checkStatus(), 30 * 1000)
		);
	}

	onunload(): void {
		this.hideStatusTooltip();
	}

	/**
	 * Updates the current status
	 */
	updateStatus(status: SyncStatus): void {
		this.currentStatus = status;
		this.updateStatusDisplay();
	}

	/**
	 * Sets status to syncing
	 */
	setSyncing(): void {
		this.updateStatus({
			status: "syncing",
			message: "Syncing with remote...",
			timestamp: Date.now(),
		});
	}

	/**
	 * Sets status to synced
	 */
	setSynced(): void {
		this.updateStatus({
			status: "synced",
			message: "Up to date",
			timestamp: Date.now(),
		});
	}

	/**
	 * Sets status to error with message
	 */
	setError(message: string): void {
		this.updateStatus({
			status: "error",
			message,
			timestamp: Date.now(),
		});
	}

	/**
	 * Sets status to conflict with message
	 */
	setConflict(message: string): void {
		this.updateStatus({
			status: "conflict",
			message,
			timestamp: Date.now(),
		});
	}

	/**
	 * Updates the visual display of the status indicator
	 */
	private updateStatusDisplay(): void {
		if (!this.statusBarItem) return;

		const { status, message } = this.currentStatus;

		const icon = this.getStatusIcon(status);
		const color = this.getStatusColor(status);

		this.statusBarItem.empty();

		const iconEl = this.statusBarItem.createSpan({ cls: "status-icon" });
		iconEl.textContent = icon;
		iconEl.style.color = color;

		const textEl = this.statusBarItem.createSpan({ cls: "status-text" });
		textEl.textContent = "Team Docs";

		this.statusBarItem.setAttribute("aria-label", message);
		this.statusBarItem.title = message;
	}

	/**
	 * Gets the appropriate icon for a status
	 */
	private getStatusIcon(status: string): string {
		switch (status) {
			case "synced":
				return "✓";
			case "syncing":
				return "↻";
			case "conflict":
				return "⚠";
			case "error":
				return "✗";
			case "offline":
				return "⚫";
			default:
				return "?";
		}
	}

	/**
	 * Gets the appropriate color for a status
	 */
	private getStatusColor(status: string): string {
		switch (status) {
			case "synced":
				return "#4caf50";
			case "syncing":
				return "#2196f3";
			case "conflict":
				return "#ff9800";
			case "error":
				return "#f44336";
			case "offline":
				return "#9e9e9e";
			default:
				return "#9e9e9e";
		}
	}

	/**
	 * Performs a status check against the Git repository
	 */
	private async checkStatus(): Promise<void> {
		try {
			const teamDocsPath = await this.plugin.gitService.getTeamDocsPath();
			if (!teamDocsPath) {
				this.updateStatus({
					status: "offline",
					message: "Team docs folder not found",
					timestamp: Date.now(),
				});
				return;
			}

			const { stdout } = await this.plugin.gitService.gitCommand(
				teamDocsPath,
				"status --porcelain"
			);
			const hasChanges = stdout.trim().length > 0;

			const { stdout: porcelain } = await this.plugin.gitService.gitCommand(
				teamDocsPath,
				"status --porcelain"
			);
			const changedFiles = porcelain
				.split("\n")
				.map((line) => line.trim().split(" ").pop())
				.filter(Boolean);
			let reservationConflict = false;
			for (const file of changedFiles) {
				const fullPath = `${this.plugin.settings.teamDocsPath}/${file}`;
				const reservation =
					this.plugin.reservationManager.getFileReservation(fullPath);
				if (
					reservation &&
					reservation.userName !== this.plugin.settings.userName
				) {
					reservationConflict = true;
					break;
				}
			}

			if (reservationConflict) {
				this.updateStatus({
					status: "conflict",
					message: "Local changes conflict with remote reservations",
					timestamp: Date.now(),
				});
				return;
			}

			if (hasChanges) {
				this.updateStatus({
					status: "syncing",
					message: "Local changes pending sync",
					timestamp: Date.now(),
				});
			} else {
				try {
					await this.plugin.gitService.gitCommand(teamDocsPath, "fetch origin");
					const { stdout: behindStatus } =
						await this.plugin.gitService.gitCommand(
							teamDocsPath,
							"rev-list --count HEAD..origin/main"
						);

					const commitsBehind = parseInt(behindStatus.trim());
					if (commitsBehind > 0) {
						this.updateStatus({
							status: "syncing",
							message: `${commitsBehind} updates available`,
							timestamp: Date.now(),
						});
					} else {
						this.setSynced();
					}
				} catch (error) {
					this.updateStatus({
						status: "offline",
						message: "Cannot reach remote repository",
						timestamp: Date.now(),
					});
				}
			}
		} catch (error) {
			this.setError("Status check failed");
		}
	}

	/**
	 * Shows detailed status information in a tooltip
	 */
	private showStatusDetails(): void {
		if (this.statusTooltip) {
			this.statusTooltip.remove();
			this.statusTooltip = null;
			return;
		}

		this.statusTooltip = document.body.createDiv("team-docs-status-tooltip");

		const header = this.statusTooltip.createDiv("status-header");
		header.createEl("h4", { text: "Team Docs Status" });

		const statusSection = this.statusTooltip.createDiv("status-section");
		statusSection.createEl("strong", { text: "Current Status: " });
		const statusText = statusSection.createSpan();
		statusText.textContent = this.currentStatus.message;
		statusText.style.color = this.getStatusColor(this.currentStatus.status);

		const myReservations = this.plugin.reservationManager.getMyReservations();
		if (myReservations.length > 0) {
			const reservationSection = this.statusTooltip.createDiv("status-section");
			reservationSection.createEl("strong", {
				text: "My Active Reservations:",
			});

			for (const reservation of myReservations) {
				const item = reservationSection.createDiv("reservation-item");
				item.textContent = `📝 ${reservation.filePath}`;
				const timeLeft = Math.round(
					(reservation.expiresAt - Date.now()) / (1000 * 60)
				);
				item.appendChild(document.createTextNode(` (${timeLeft}m left)`));
			}
		}

		const actionsSection = this.statusTooltip.createDiv("status-actions");

		const syncButton = actionsSection.createEl("button", { text: "Sync Now" });
		syncButton.onclick = () => {
			this.plugin.gitService.syncTeamDocs();
			this.hideStatusTooltip();
		};

		const activityButton = actionsSection.createEl("button", {
			text: "Show Activity",
		});
		activityButton.onclick = () => {
			this.plugin.uiManager.openActivityFeed();
			this.hideStatusTooltip();
		};

		if (this.statusBarItem) {
			const rect = this.statusBarItem.getBoundingClientRect();

			const tooltipRect = this.statusTooltip.getBoundingClientRect();

			let left = rect.left;
			let bottom = window.innerHeight - rect.top + 10;

			if (left + tooltipRect.width > window.innerWidth - 10) {
				left = window.innerWidth - tooltipRect.width - 10;
			}

			if (left < 10) {
				left = 10;
			}

			if (tooltipRect.height + 20 > rect.top) {
				this.statusTooltip.style.top = rect.bottom + 10 + "px";
				this.statusTooltip.style.bottom = "auto";
			} else {
				this.statusTooltip.style.bottom = bottom + "px";
			}

			this.statusTooltip.style.position = "fixed";
			this.statusTooltip.style.left = left + "px";
			this.statusTooltip.style.zIndex = "9999";
			this.statusTooltip.style.maxWidth = "min(350px, 90vw)";
		}

		setTimeout(() => {
			document.addEventListener("click", this.hideStatusTooltipHandler, {
				once: true,
			});
		}, 100);
	}

	private hideStatusTooltipHandler = (event: MouseEvent) => {
		if (
			this.statusTooltip &&
			!this.statusTooltip.contains(event.target as Node)
		) {
			this.hideStatusTooltip();
		}
	};

	/**
	 * Hides the status tooltip
	 */
	private hideStatusTooltip(): void {
		if (this.statusTooltip) {
			this.statusTooltip.remove();
			this.statusTooltip = null;
		}
	}
}
