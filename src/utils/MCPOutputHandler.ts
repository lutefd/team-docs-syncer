import { Notice } from "obsidian";
import { MCPClientConfig } from "../types/Settings";
import { OAuthService } from "../services/OAuthService";

export class MCPOutputHandler {
	private shownPermissionNotices: Set<string> = new Set();
	private oauthManager: OAuthService;

	constructor(private config: MCPClientConfig) {
		this.oauthManager = new OAuthService();
	}

	async handleOutput(output: string): Promise<void> {
		await this.handleOAuthDetection(output);
		this.handlePermissionError(output);
	}

	private async handleOAuthDetection(output: string): Promise<void> {
		const oauthInfo = this.oauthManager.detectOAuthFromOutput(output);

		if (oauthInfo.requiresAuth) {
			if (oauthInfo.authUrl) {
				if (!this.oauthManager.hasActiveFlow(this.config.id)) {
					try {
						await this.oauthManager.startOAuthFlow(
							this.config.id,
							oauthInfo.authUrl,
							oauthInfo.callbackPort,
							oauthInfo.state
						);
					} catch (error) {
						console.error(
							`Failed to start OAuth flow for ${this.config.name}:`,
							error
						);
					}
				}
			} else {
				console.warn(
					`OAuth required for ${this.config.name} but no authorization URL found. Output:`,
					output.substring(0, 500)
				);
			}
		}
	}

	private handlePermissionError(output: string): void {
		const accessDeniedPattern =
			/Error POSTing to endpoint \(HTTP 403\):\s*(.+?)(?:\n|$)/i;
		const linkPattern = /Link:\s*(https?:\/\/[^\s]+)/i;
		const descriptionPattern = /Description:\s*(.+?)(?:\n|$)/i;

		const accessMatch = output.match(accessDeniedPattern);
		if (accessMatch) {
			const errorMessage = accessMatch[1];
			const linkMatch = output.match(linkPattern);
			const descriptionMatch = output.match(descriptionPattern);

			const noticeKey = `${this.config.name}:${
				linkMatch ? linkMatch[1] : errorMessage
			}`;

			if (this.shownPermissionNotices.has(noticeKey)) {
				return;
			}

			this.shownPermissionNotices.add(noticeKey);

			const notice = {
				title: `Access Permission Required - ${this.config.name}`,
				message: errorMessage,
				requestUrl: linkMatch ? linkMatch[1] : null,
				description: descriptionMatch ? descriptionMatch[1] : null,
				timestamp: new Date().toISOString(),
				clientName: this.config.name,
			};

			this.showPermissionNotice(notice);
		}
	}

	private showPermissionNotice(notice: {
		title: string;
		message: string;
		requestUrl: string | null;
		description: string | null;
		timestamp: string;
		clientName: string;
	}): void {
		let noticeText = `${notice.title}\n\n${notice.message}`;

		if (notice.description) {
			noticeText += `\n\nDescription: ${notice.description}`;
		}

		if (notice.requestUrl) {
			navigator.clipboard
				.writeText(notice.requestUrl)
				.then(() => {
					console.log(`Copied access URL to clipboard: ${notice.requestUrl}`);
				})
				.catch((err) => {
					console.warn("Failed to copy URL to clipboard:", err);
				});

			noticeText += `\n\nAccess URL copied to clipboard.\nClick here to open: ${notice.requestUrl}`;
		}

		const noticeEl = new Notice(noticeText, 10000);

		if (notice.requestUrl) {
			const noticeContainer = noticeEl.noticeEl;
			noticeContainer.style.cursor = "pointer";

			const urlRegex = new RegExp(
				notice.requestUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
				"g"
			);
			noticeContainer.innerHTML = noticeContainer.innerHTML.replace(
				urlRegex,
				`<span style="color: #0066cc; text-decoration: underline;">${notice.requestUrl}</span>`
			);

			noticeContainer.addEventListener("click", (e) => {
				e.preventDefault();
				window.open(notice.requestUrl!, "_blank");
			});
		}

		console.warn(`Permission error for ${notice.clientName}:`, notice);
	}
}
