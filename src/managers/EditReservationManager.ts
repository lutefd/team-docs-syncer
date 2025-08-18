import { App, TFile, Notice, Component } from "obsidian";
import TeamDocsPlugin from "../../main";

/**
 * Represents a file reservation for collaborative editing
 */
export interface EditReservation {
	filePath: string;
	userName: string;
	timestamp: number;
	expiresAt: number;
}

/*
 * Manages file reservations for collaborative editing
 */
export class EditReservationManager extends Component {
	private app: App;
	private plugin: TeamDocsPlugin;
	private reservations: Map<string, EditReservation> = new Map();
	private checkInterval: number | null = null;
	private readonly RESERVATION_DURATION = 15 * 60 * 1000;
	private readonly CHECK_INTERVAL = 60 * 1000;
	private readonly WARNING_THRESHOLD = 5 * 60 * 1000;
	private readonly EXTEND_THRESHOLD = 5 * 60 * 1000;
	private pendingOperations: Map<string, Promise<any>> = new Map();
	private lastExtensionTime: Map<string, number> = new Map();

	constructor(app: App, plugin: TeamDocsPlugin) {
		super();
		this.app = app;
		this.plugin = plugin;
	}

	onload(): void {
		this.startReservationChecker();
	}

	onunload(): void {
		this.destroy();
	}

	/**
	 * Reserves a file for editing if not already reserved by another user
	 */
	async reserveFile(file: TFile): Promise<boolean> {
		const filePath = file.path;

		if (this.pendingOperations.has(filePath)) {
			await this.pendingOperations.get(filePath);
			return (
				this.getFileReservation(filePath)?.userName ===
				this.plugin.settings.userName
			);
		}

		const operation = this.performReservation(file);
		this.pendingOperations.set(filePath, operation);

		try {
			const result = await operation;
			return result;
		} finally {
			this.pendingOperations.delete(filePath);
		}
	}

	/**
	 * Internal method to perform the actual reservation
	 */
	private async performReservation(file: TFile): Promise<boolean> {
		const filePath = file.path;

		const existingReservation = this.reservations.get(filePath);
		if (
			existingReservation &&
			existingReservation.userName !== this.plugin.settings.userName
		) {
			if (Date.now() < existingReservation.expiresAt) {
				new Notice(
					`File is being edited by ${existingReservation.userName}. Try again later.`
				);
				return false;
			}
		}

		if (
			existingReservation &&
			existingReservation.userName === this.plugin.settings.userName &&
			Date.now() < existingReservation.expiresAt
		) {
			return true;
		}

		const reservation: EditReservation = {
			filePath,
			userName: this.plugin.settings.userName,
			timestamp: Date.now(),
			expiresAt: Date.now() + this.RESERVATION_DURATION,
		};

		this.reservations.set(filePath, reservation);

		try {
			await this.commitReservation(reservation, "reserve");
			await this.pushReservation();

			new Notice(`File reserved for editing (15 min)`, 3000);
			try {
				this.plugin.uiManager.updateFileReservationUI(file);
			} catch (e) {}
			return true;
		} catch (error) {
			this.reservations.delete(filePath);
			new Notice("Failed to reserve file. Please try again.");
			return false;
		}
	}

	/**
	 * Releases the reservation for a specific file
	 */
	async releaseFile(file: TFile): Promise<void> {
		await this.releaseReservationByPath(file.path);
	}

	/**
	 * Releases a reservation by file path
	 */
	async releaseReservationByPath(filePath: string): Promise<void> {
		const reservation = this.reservations.get(filePath);

		if (reservation && reservation.userName === this.plugin.settings.userName) {
			this.reservations.delete(filePath);
			this.lastExtensionTime.delete(filePath);

			try {
				await this.commitReservation(reservation, "release");
				await this.pushReservation();
				new Notice("File reservation released", 2000);
			} catch (error) {
				this.reservations.set(filePath, reservation);
				console.error(`Failed to release reservation for ${filePath}:`, error);
				new Notice("Failed to release reservation. Please try again.");
			}
		}
	}

	/**
	 * Extends the reservation duration for a file
	 * Only extends if reservation is close to expiring and hasn't been extended recently
	 */
	async extendReservation(file: TFile): Promise<boolean> {
		const filePath = file.path;
		const reservation = this.reservations.get(filePath);

		if (
			!reservation ||
			reservation.userName !== this.plugin.settings.userName
		) {
			return false;
		}

		const now = Date.now();
		const timeRemaining = reservation.expiresAt - now;
		const lastExtension = this.lastExtensionTime.get(filePath) || 0;
		const timeSinceLastExtension = now - lastExtension;

		if (timeRemaining > this.EXTEND_THRESHOLD) {
			return false;
		}

		if (timeSinceLastExtension < 2 * 60 * 1000) {
			return false;
		}

		const oldExpiresAt = reservation.expiresAt;
		const oldTimestamp = reservation.timestamp;
		reservation.timestamp = now;
		reservation.expiresAt = now + this.RESERVATION_DURATION;
		this.reservations.set(filePath, reservation);
		this.lastExtensionTime.set(filePath, now);

		try {
			await this.commitReservation(reservation, "extend");
			await this.pushReservation();

			const minutesLeft = Math.round(timeRemaining / 60000);

			if (timeRemaining < 2 * 60 * 1000) {
				new Notice(`Reservation extended (+15 min)`, 2000);
			}

			return true;
		} catch (error) {
			reservation.expiresAt = oldExpiresAt;
			reservation.timestamp = oldTimestamp;
			this.reservations.set(filePath, reservation);
			this.lastExtensionTime.delete(filePath);
			console.error(`Failed to extend reservation for ${filePath}:`, error);
			return false;
		}
	}

	/**
	 * Gets the active reservation for a file path
	 */
	getFileReservation(filePath: string): EditReservation | null {
		const reservation = this.reservations.get(filePath);
		if (reservation && Date.now() < reservation.expiresAt) {
			return reservation;
		}
		if (reservation && Date.now() >= reservation.expiresAt) {
			this.reservations.delete(filePath);
			this.lastExtensionTime.delete(filePath);
		}
		return null;
	}

	/**
	 * Gets all active reservations owned by the current user
	 */
	getMyReservations(): EditReservation[] {
		const myReservations: EditReservation[] = [];
		for (const reservation of this.reservations.values()) {
			if (
				reservation.userName === this.plugin.settings.userName &&
				Date.now() < reservation.expiresAt
			) {
				myReservations.push(reservation);
			}
		}
		return myReservations;
	}

	/**
	 * Commits a reservation action as an empty Git commit
	 */
	private async commitReservation(
		reservation: EditReservation,
		action: "reserve" | "release" | "extend"
	): Promise<void> {
		const teamDocsPath = await this.plugin.gitService.getTeamDocsPath();
		if (!teamDocsPath) throw new Error("Team docs path not found");

		const message = `[${action.toUpperCase()}] ${reservation.filePath} - ${
			reservation.userName
		} - ${new Date(reservation.timestamp).toISOString()}`;

		await this.plugin.gitService.gitCommand(teamDocsPath, `add -A`);
		await this.plugin.gitService.gitCommandRetry(
			teamDocsPath,
			`commit --allow-empty -m "${message}"`
		);
	}

	/**
	 * Pushes the latest changes to the remote repository
	 */
	private async pushReservation(): Promise<void> {
		const teamDocsPath = await this.plugin.gitService.getTeamDocsPath();
		if (!teamDocsPath) throw new Error("Team docs path not found");

		await this.plugin.gitService.gitCommandRetry(
			teamDocsPath,
			"push origin main"
		);
	}

	/**
	 * Starts the interval checker for expired reservations and warnings
	 */
	private startReservationChecker(): void {
		this.checkInterval = this.registerInterval(
			window.setInterval(() => {
				this.checkExpiredReservations();
			}, this.CHECK_INTERVAL)
		);
	}

	/**
	 * Checks for expired reservations and warns about soon-expiring ones
	 */
	private checkExpiredReservations(): void {
		const now = Date.now();
		const expiredKeys: string[] = [];

		for (const [filePath, reservation] of this.reservations.entries()) {
			if (now >= reservation.expiresAt) {
				expiredKeys.push(filePath);
			} else if (
				reservation.userName === this.plugin.settings.userName &&
				reservation.expiresAt - now < this.WARNING_THRESHOLD &&
				reservation.expiresAt - now >
					this.WARNING_THRESHOLD - this.CHECK_INTERVAL
			) {
				const timeLeft = Math.round(
					(reservation.expiresAt - now) / (1000 * 60)
				);
				new Notice(
					`Reservation for ${filePath} expires in ${timeLeft} minutes. Extend or release it soon.`
				);
			}
		}

		for (const key of expiredKeys) {
			this.reservations.delete(key);
			this.lastExtensionTime.delete(key);
		}
	}

	/**
	 * Syncs reservations from recent Git commit history
	 */
	async syncReservationsFromGit(): Promise<void> {
		try {
			const teamDocsPath = await this.plugin.gitService.getTeamDocsPath();
			if (!teamDocsPath) return;

			await this.plugin.gitService.gitCommandRetry(
				teamDocsPath,
				"fetch origin"
			);

			const { stdout } = await this.plugin.gitService.gitCommand(
				teamDocsPath,
				"log origin/main --oneline -50"
			);

			const oldReservations = new Map(this.reservations);
			this.reservations.clear();

			const lines = stdout.split("\n").filter((line) => line.trim());
			for (const line of lines) {
				this.parseReservationFromCommit(line);
			}

			for (const [filePath, reservation] of oldReservations) {
				if (
					reservation.userName === this.plugin.settings.userName &&
					Date.now() < reservation.expiresAt &&
					!this.reservations.has(filePath)
				) {
					this.reservations.set(filePath, reservation);
				}
			}
		} catch (error) {
			console.error("Failed to sync reservations from git:", error);
		}
	}

	/**
	 * Parses a reservation from a Git commit line
	 */
	private parseReservationFromCommit(commitLine: string): void {
		const reserveMatch = commitLine.match(/\[RESERVE\] (.+?) - (.+?) - (.+)/);
		const releaseMatch = commitLine.match(/\[RELEASE\] (.+?) - (.+?) - (.+)/);
		const extendMatch = commitLine.match(/\[EXTEND\] (.+?) - (.+?) - (.+)/);

		if (reserveMatch || extendMatch) {
			const match = reserveMatch || extendMatch;
			const [, filePath, userName, timestamp] = match!;
			const reservation: EditReservation = {
				filePath,
				userName,
				timestamp: new Date(timestamp).getTime(),
				expiresAt: new Date(timestamp).getTime() + this.RESERVATION_DURATION,
			};

			if (Date.now() < reservation.expiresAt) {
				this.reservations.set(filePath, reservation);
			}
		} else if (releaseMatch) {
			const [, filePath] = releaseMatch;
			this.reservations.delete(filePath);
		}
	}

	/**
	 * Cleans up the interval on destruction
	 */
	destroy(): void {
		if (this.checkInterval !== null) {
			window.clearInterval(this.checkInterval);
			this.checkInterval = null;
		}
		this.pendingOperations.clear();
		this.lastExtensionTime.clear();
	}
}
