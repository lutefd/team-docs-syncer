import {
	App,
	TFile,
	TFolder,
	TAbstractFile,
	Editor,
	MarkdownView,
	Notice,
} from "obsidian";
import * as path from "path";
import TeamDocsPlugin from "../../main";
import { ConfirmationModal } from "../ui/ConfirmationModal";

/**
 * Handles file operations and events for team docs
 */
export class FileHandler {
	private warnedFiles: Set<string> = new Set();
	private processingFiles: Set<string> = new Set();
	private autoCommitTimeouts: Map<string, NodeJS.Timeout> = new Map();
	private readonly EXTEND_THRESHOLD = 5 * 60 * 1000;

	constructor(private app: App, private plugin: TeamDocsPlugin) {}

	/**
	 * Registers all file-related event handlers
	 */
	registerEventHandlers() {
		this.plugin.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile) {
					this.onFileModified(file);
				}
			})
		);

		this.plugin.registerEvent(
			this.app.vault.on("create", async (file) => {
				if (file instanceof TFile) {
					await this.onFileCreated(file);
				}
			})
		);

		this.plugin.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file.path.startsWith(this.plugin.settings.teamDocsPath + "/")) {
					this.onFileDeleted(file);
				}
			})
		);

		this.plugin.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				if (file) {
					this.plugin.uiManager.updateFileReservationUI(file);
					this.warnedFiles.clear();
				}
			})
		);

		this.plugin.registerEvent(
			this.app.workspace.on(
				"editor-change",
				(editor: Editor, info: MarkdownView) => {
					this.onEditorChange(editor, info);
				}
			)
		);
	}

	/**
	 * Handles file modification events
	 */
	private async onFileModified(file: TFile) {
		if (!file.path.startsWith(this.plugin.settings.teamDocsPath + "/")) return;

		if (this.processingFiles.has(file.path)) {
			console.log(`Already processing ${file.path}, skipping...`);
			return;
		}

		this.processingFiles.add(file.path);

		try {
			const existingTimeout = this.autoCommitTimeouts.get(file.path);
			if (existingTimeout) {
				clearTimeout(existingTimeout);
				this.autoCommitTimeouts.delete(file.path);
			}

			await this.plugin.reservationManager.syncReservationsFromGit();

			const reservation = this.plugin.reservationManager.getFileReservation(
				file.path
			);

			if (
				reservation &&
				reservation.userName !== this.plugin.settings.userName
			) {
				await this.plugin.gitService.restoreFileFromGit(file.path);
				new Notice(
					`File reserved by ${reservation.userName}. Changes reverted. Sync and try reserving first.`
				);
				return;
			}

			if (!reservation) {
				console.log(
					`No reservation found for ${file.path}, attempting to reserve...`
				);
				const reserved = await this.plugin.reservationManager.reserveFile(file);
				if (!reserved) {
					await this.plugin.gitService.restoreFileFromGit(file.path);
					new Notice("Failed to reserve file. Changes reverted.");
					return;
				}
			} else if (reservation.userName === this.plugin.settings.userName) {
				const timeRemaining = reservation.expiresAt - Date.now();
				if (timeRemaining <= this.EXTEND_THRESHOLD) {
					console.log(
						`Reservation for ${file.path} expires soon (${Math.round(
							timeRemaining / 60000
						)}min), extending...`
					);
					const extended =
						await this.plugin.reservationManager.extendReservation(file);
					if (!extended) {
						console.warn(`Failed to extend reservation for ${file.path}`);
					}
				} else {
					console.log(
						`Reservation for ${file.path} still valid for ${Math.round(
							timeRemaining / 60000
						)} minutes, no extension needed`
					);
				}
			}

			const timeout = setTimeout(() => {
				this.autoCommitFile(file);
				this.autoCommitTimeouts.delete(file.path);
			}, 10000);

			this.autoCommitTimeouts.set(file.path, timeout);
		} finally {
			this.processingFiles.delete(file.path);
		}
	}

	/**
	 * Handles newly created files (e.g., pasted images) and moves images into the configured attachments subdirectory
	 */
	private async onFileCreated(file: TFile) {
		const teamRoot = this.plugin.settings.teamDocsPath;
		if (!teamRoot) return;

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || !activeFile.path.startsWith(teamRoot + "/")) return;

		const attachmentsSubdir = this.plugin.settings.attachmentsSubdir || "";
		if (!attachmentsSubdir || !attachmentsSubdir.trim()) return;

		const ext = path.extname(file.name).toLowerCase().replace(".", "");
		const imageExts = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp"]);
		if (!imageExts.has(ext)) return;

		const normalizedSub = attachmentsSubdir.replace(/^\/+|\/+$/g, "");
		const targetDir = `${teamRoot}/${normalizedSub}`;
		if (file.path.startsWith(targetDir + "/")) return;

		const existing = this.app.vault.getAbstractFileByPath(targetDir);
		if (!existing) {
			try {
				await this.app.vault.createFolder(targetDir);
			} catch (e) {
				console.warn("Failed to create attachments folder:", targetDir, e);
				return;
			}
		}

		const parsed = path.parse(file.name);
		let destPath = `${targetDir}/${file.name}`;
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(destPath)) {
			destPath = `${targetDir}/${parsed.name}_${counter}${parsed.ext}`;
			counter++;
		}

		try {
			await this.app.fileManager.renameFile(file, destPath);
			console.log(`Moved attachment to ${destPath}`);
		} catch (e) {
			console.warn(
				"Failed to move attachment to target directory:",
				destPath,
				e
			);
		}
	}

	/**
	 * Handles file deletion events
	 */
	private async onFileDeleted(file: TAbstractFile) {
		new Notice("Deletion detected in Team Docs—checking reservations...");

		await this.plugin.reservationManager.syncReservationsFromGit();

		const isFolder = file instanceof TFolder;
		const pathsToCheck = isFolder
			? this.getAllSubPaths(file as TFolder)
			: [file.path];

		let ownReservationPaths: string[] = [];
		let otherReservationPaths: string[] = [];

		for (const p of pathsToCheck) {
			const reservation = this.plugin.reservationManager.getFileReservation(p);
			if (reservation) {
				if (reservation.userName === this.plugin.settings.userName) {
					ownReservationPaths.push(p);
				} else {
					otherReservationPaths.push(p);
				}
			}
		}

		if (otherReservationPaths.length > 0) {
			for (const p of pathsToCheck) {
				await this.plugin.gitService.restoreFileFromGit(p);
			}
			new Notice(
				`Cannot delete: Some files are reserved by others (${otherReservationPaths.join(
					", "
				)}). Files restored.`
			);
			return;
		}

		if (ownReservationPaths.length > 0) {
			new ConfirmationModal(
				this.app,
				"Confirm Deletion",
				`This item contains files reserved by you (${ownReservationPaths.join(
					", "
				)}). Delete anyway? This will release the reservations.`,
				async (confirm) => {
					if (confirm) {
						for (const p of ownReservationPaths) {
							await this.plugin.reservationManager.releaseReservationByPath(p);
						}
						new Notice(
							"Deletion confirmed. It will be committed on next sync."
						);
					} else {
						for (const p of pathsToCheck) {
							await this.plugin.gitService.restoreFileFromGit(p);
						}
						new Notice(`Deletion cancelled. Files restored.`);
					}
				}
			).open();
		} else {
			new Notice("Deletion allowed. It will be committed on next sync.");
		}
	}

	/**
	 * Handles editor change events for pre-edit warnings
	 */
	private onEditorChange(editor: Editor, info: MarkdownView) {
		const file = info.file;
		if (!file || !file.path.startsWith(this.plugin.settings.teamDocsPath + "/"))
			return;

		if (this.warnedFiles.has(file.path)) return;

		const reservation = this.plugin.reservationManager.getFileReservation(
			file.path
		);

		if (reservation && reservation.userName !== this.plugin.settings.userName) {
			new Notice(
				`Warning: This file is reserved by ${reservation.userName}. Changes may be reverted on save.`
			);
			this.plugin.uiManager.enforceReadView(file);
			this.warnedFiles.add(file.path);
		}

		// If it's our reservation and it's close to expiring, extend proactively while editing
		if (reservation && reservation.userName === this.plugin.settings.userName) {
			const timeRemaining = reservation.expiresAt - Date.now();
			if (timeRemaining <= this.EXTEND_THRESHOLD) {
				this.plugin.reservationManager.extendReservation(file);
			}
		}
	}

	/**
	 * Automatically commits a file after modification
	 */
	private async autoCommitFile(file: TFile) {
		if (this.processingFiles.has(file.path)) {
			console.log(`File ${file.path} is being processed, skipping auto-commit`);
			return;
		}

		try {
			const teamDocsFullPath = await this.plugin.gitService.getTeamDocsPath();
			if (!teamDocsFullPath) {
				console.log("Could not determine team docs path");
				return;
			}

			const reservation = this.plugin.reservationManager.getFileReservation(
				file.path
			);
			if (
				!reservation ||
				reservation.userName !== this.plugin.settings.userName
			) {
				console.log(
					`No valid reservation for ${file.path}, skipping auto-commit`
				);
				return;
			}

			const relativePath = path.relative(
				this.plugin.settings.teamDocsPath,
				file.path
			);

			await this.plugin.gitService.gitCommand(
				teamDocsFullPath,
				`add "${relativePath}"`
			);
			await this.plugin.gitService.gitCommand(
				teamDocsFullPath,
				`commit -m "Auto-save: ${file.name} by ${this.plugin.settings.userName}"`
			);

			this.plugin.statusIndicator.updateStatus({
				status: "syncing",
				message: "Local changes ready to sync",
				timestamp: Date.now(),
			});

			console.log(`Auto-committed changes for ${file.path}`);
		} catch (error) {
			console.log("Auto-commit failed:", error);
		}
	}

	/**
	 * Gets all file paths within a folder recursively
	 */
	private getAllSubPaths(folder: TFolder): string[] {
		const paths: string[] = [];
		folder.children.forEach((child) => {
			if (child instanceof TFile) paths.push(child.path);
			else if (child instanceof TFolder)
				paths.push(...this.getAllSubPaths(child));
		});
		return paths;
	}
}
