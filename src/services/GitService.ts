import { App, Notice, FileSystemAdapter } from "obsidian";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import TeamDocsPlugin from "../../main";
import { ConflictResolutionModal } from "../ui/ConflictResolutionModal";
import { LocalChangesModal } from "../ui/LocalChangesModal";

const execAsync = promisify(exec);

/**
 * Handles all Git operations for team docs synchronization
 */
export class GitService {
	constructor(private app: App, private plugin: TeamDocsPlugin) {}

	/**
	 * Gets the full filesystem path to the team docs directory
	 */
	async getTeamDocsPath(): Promise<string | null> {
		try {
			if (this.app.vault.adapter instanceof FileSystemAdapter) {
				return this.app.vault.adapter.getFullPath(
					this.plugin.settings.teamDocsPath
				);
			} else {
				new Notice("Git sync is only supported on desktop version of Obsidian");
				return null;
			}
		} catch (error) {
			console.error("Error getting team docs path:", error);
			return null;
		}
	}

	/**
	 * Executes a Git command in the specified directory
	 */
	async gitCommand(
		cwd: string,
		command: string
	): Promise<{ stdout: string; stderr: string }> {
		try {
			return await execAsync(`git ${command}`, { cwd });
		} catch (error) {
			throw new Error(error.message);
		}
	}

	/**
	 * Synchronizes team docs with remote repository
	 */
	async syncTeamDocs() {
		const teamDocsPath = await this.getTeamDocsPath();
		if (!teamDocsPath) return;

		try {
			this.plugin.statusIndicator.setSyncing();

			await this.gitCommand(teamDocsPath, "fetch origin");

			try {
				await this.gitCommand(teamDocsPath, "pull origin main");
			} catch (pullError) {
				if (
					pullError.message.includes("would be overwritten by merge") ||
					pullError.message.includes(
						"Your local changes to the following files would be overwritten"
					)
				) {
					this.handleLocalChangesConflict(teamDocsPath);
					return;
				} else if (
					pullError.message.includes("CONFLICT") ||
					pullError.message.includes("conflict")
				) {
					this.handleMergeConflicts(pullError.message);
					return;
				}
				throw pullError;
			}

			await this.plugin.reservationManager.syncReservationsFromGit();

			if (!(await this.validateLocalChangesForPush(teamDocsPath))) {
				new Notice(
					"Sync aborted: Local changes conflict with remote reservations."
				);
				this.plugin.statusIndicator.setConflict(
					"Changes conflict with reservations"
				);
				return;
			}

			await this.pushChanges(teamDocsPath);

			this.plugin.statusIndicator.setSynced();
			new Notice("Team docs synced successfully!");
		} catch (error) {
			console.error("Sync failed:", error);
			this.plugin.statusIndicator.setError(`Sync failed: ${error.message}`);
			new Notice(`Sync failed: ${error.message}`);
		}
	}

	/**
	 * Forces a pull from remote, discarding local changes
	 */
	async forcePullTeamDocs() {
		const teamDocsPath = await this.getTeamDocsPath();
		if (!teamDocsPath) return;

		try {
			new Notice("Force pulling latest changes...");
			this.plugin.statusIndicator.setSyncing();
			await this.gitCommand(teamDocsPath, "fetch origin");
			await this.gitCommand(teamDocsPath, "reset --hard origin/main");
			this.plugin.statusIndicator.setSynced();
			new Notice("Force pull completed!");
		} catch (error) {
			this.plugin.statusIndicator.setError(
				`Force pull failed: ${error.message}`
			);
			new Notice(`Force pull failed: ${error.message}`);
		}
	}

	/**
	 * Restores a file from the Git repository
	 */
	async restoreFileFromGit(filePath: string) {
		const teamDocsPath = await this.getTeamDocsPath();
		if (!teamDocsPath) return;

		const relativePath = path.relative(
			this.plugin.settings.teamDocsPath,
			filePath
		);
		try {
			await this.gitCommand(teamDocsPath, `checkout HEAD -- "${relativePath}"`);
		} catch (error) {
			console.error(`Failed to restore ${filePath}:`, error);
		}
	}

	private async handleLocalChangesConflict(repoPath: string): Promise<void> {
		try {
			new LocalChangesModal(this.app, (action) => {
				this.resolveLocalChanges(repoPath, action);
			}).open();
		} catch (error) {
			this.plugin.statusIndicator.setError(
				`Failed to handle local changes: ${error.message}`
			);
		}
	}

	private async resolveLocalChanges(
		repoPath: string,
		action: "commit" | "stash" | "discard"
	) {
		try {
			switch (action) {
				case "commit":
					await this.gitCommand(repoPath, "add .");
					await this.gitCommand(
						repoPath,
						`commit -m "Save local changes by ${this.plugin.settings.userName}"`
					);
					await this.gitCommand(repoPath, "pull origin main");
					break;

				case "stash":
					await this.gitCommand(
						repoPath,
						"stash push -m 'Auto-stashed before sync'"
					);
					await this.gitCommand(repoPath, "pull origin main");
					try {
						await this.gitCommand(repoPath, "stash pop");
					} catch (stashError) {
						new Notice(
							"Stash applied but conflicts may need manual resolution"
						);
					}
					break;

				case "discard":
					await this.gitCommand(repoPath, "reset --hard HEAD");
					await this.gitCommand(repoPath, "pull origin main");
					break;
			}

			this.plugin.statusIndicator.setSynced();
			new Notice("Local changes resolved and synced!");
		} catch (error) {
			this.plugin.statusIndicator.setError(
				`Failed to resolve local changes: ${error.message}`
			);
			new Notice(`Failed to resolve local changes: ${error.message}`);
		}
	}

	private handleMergeConflicts(conflictMessage: string) {
		new ConflictResolutionModal(this.app, conflictMessage, (resolution) => {
			this.resolveConflict(resolution);
		}).open();
	}

	private async resolveConflict(resolution: "theirs" | "mine" | "manual") {
		const teamDocsPath = await this.getTeamDocsPath();
		if (!teamDocsPath) return;

		try {
			if (resolution === "theirs") {
				await this.gitCommand(teamDocsPath, "reset --hard origin/main");
				this.plugin.statusIndicator.setSynced();
				new Notice("Conflicts resolved: Using remote version");
			} else if (resolution === "mine") {
				await this.gitCommand(teamDocsPath, "add .");
				await this.gitCommand(
					teamDocsPath,
					`commit -m "Resolve conflict: Keep local changes by ${this.plugin.settings.userName}"`
				);
				this.plugin.statusIndicator.setSynced();
				new Notice("Conflicts resolved: Using local version");
			} else {
				this.plugin.statusIndicator.setConflict(
					"Manual conflict resolution required"
				);
				new Notice(
					"Please resolve conflicts manually using your preferred merge tool"
				);
			}
		} catch (error) {
			this.plugin.statusIndicator.setError(
				`Conflict resolution failed: ${error.message}`
			);
			new Notice(`Conflict resolution failed: ${error.message}`);
		}
	}

	private async pushChanges(repoPath: string) {
		try {
			const { stdout } = await this.gitCommand(repoPath, "status --porcelain");
			if (stdout.trim()) {
				await this.gitCommand(repoPath, "add .");
				await this.gitCommand(
					repoPath,
					`commit -m "Sync: Updates by ${this.plugin.settings.userName}"`
				);
			}

			if (!(await this.validateLocalChangesForPush(repoPath))) {
				throw new Error("Push aborted: Conflicts with remote reservations");
			}

			await this.gitCommand(repoPath, "push origin main");
		} catch (error) {
			if (error.message.includes("nothing to commit")) {
				return;
			}
			throw error;
		}
	}

	private async validateLocalChangesForPush(
		repoPath: string
	): Promise<boolean> {
		const { stdout } = await this.gitCommand(repoPath, "status --porcelain");
		const changedFiles = stdout
			.split("\n")
			.map((line) => line.trim().split(" ").pop())
			.filter(Boolean);

		for (const file of changedFiles) {
			const fullPath = `${this.plugin.settings.teamDocsPath}/${file}`;
			const reservation =
				this.plugin.reservationManager.getFileReservation(fullPath);
			if (
				reservation &&
				reservation.userName !== this.plugin.settings.userName
			) {
				return false;
			}
		}
		return true;
	}
}
