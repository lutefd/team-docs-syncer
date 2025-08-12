import { App, Notice, TFile, MarkdownView } from "obsidian";
import TeamDocsPlugin from "../../main";
import { ACTIVITY_FEED_VIEW } from "../ui/TeamActivityFeed";
import { CHATBOT_VIEW } from "../ui/ChatbotView";
import { ConfirmationModal } from "../ui/ConfirmationModal";

/**
 * Manages UI updates and interactions
 */
export class UIManager {
	constructor(private app: App, private plugin: TeamDocsPlugin) {}

	/**
	 * Opens the team docs chatbot view
	 */
	openChatbot(): void {
		const existingLeaf = this.app.workspace.getLeavesOfType(CHATBOT_VIEW)[0];
		if (existingLeaf) {
			this.app.workspace.revealLeaf(existingLeaf);
			return;
		}

		this.app.workspace.detachLeavesOfType(CHATBOT_VIEW);
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			leaf.setViewState({
				type: CHATBOT_VIEW,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Opens the team activity feed view
	 */
	openActivityFeed(): void {
		const existingLeaf =
			this.app.workspace.getLeavesOfType(ACTIVITY_FEED_VIEW)[0];
		if (existingLeaf) {
			this.app.workspace.revealLeaf(existingLeaf);
			return;
		}

		this.app.workspace.detachLeavesOfType(ACTIVITY_FEED_VIEW);
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			leaf.setViewState({
				type: ACTIVITY_FEED_VIEW,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Updates the file reservation indicator in the UI
	 */
	updateFileReservationUI(file: TFile) {
		if (!file.path.startsWith(this.plugin.settings.teamDocsPath + "/")) {
			return;
		}

		const reservation = this.plugin.reservationManager.getFileReservation(
			file.path
		);

		const existingIndicator = document.querySelector(
			".file-reservation-indicator"
		);
		if (existingIndicator) {
			existingIndicator.remove();
		}

		if (reservation) {
			const viewHeader = document.querySelector(
				".workspace-leaf.mod-active .view-header"
			);
			if (viewHeader) {
				const indicator = viewHeader.createDiv("file-reservation-indicator");
				if (reservation.userName === this.plugin.settings.userName) {
					indicator.addClass("own-reservation");
					indicator.textContent = `Reserved by you`;
					indicator.style.cursor = "pointer";
					indicator.addEventListener("click", () => {
						this.handleReservationRelease(file, reservation);
					});
				} else {
					indicator.textContent = `Reserved by ${reservation.userName}`;
					this.enforceReadView(file);
				}
			}
		}
	}

	/**
	 * Ensures the active view for the provided file is in reading mode (preview)
	 * when the file is reserved by another user. Uses best-effort, no-op if API changes.
	 */
	enforceReadView(file: TFile) {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.path !== file.path) return;

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		try {
			const anyView = view as any;
			const currentMode =
				typeof anyView.getMode === "function" ? anyView.getMode() : undefined;
			if (currentMode !== "preview") {
				if (typeof anyView.setMode === "function") {
					anyView.setMode("preview");
				}
			}
		} catch (e) {
			console.log("Failed to enforce read-view:", e);
		}
	}

	/**
	 * Handles the release of a file reservation
	 */
	private handleReservationRelease(file: TFile, reservation: any) {
		const activeFile = this.app.workspace.getActiveFile();
		if (
			activeFile &&
			activeFile.path === file.path &&
			reservation.userName === this.plugin.settings.userName
		) {
			new ConfirmationModal(
				this.app,
				"Release Reservation",
				"Are you sure you want to release this reservation? This will allow others to edit the file.",
				async (confirm) => {
					if (confirm) {
						await this.plugin.reservationManager.releaseFile(activeFile);
						this.updateFileReservationUI(activeFile);
						new Notice("Reservation released.");
					}
				}
			).open();
		}
	}
}
