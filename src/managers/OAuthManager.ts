/**
 * OAuth flow state for tracking authentication processes
 */
interface OAuthFlow {
	clientId: string;
	authUrl: string;
	callbackPort?: number;
	state?: string;
	codeChallenge?: string;
	timestamp: number;
}

/**
 * Manager for handling OAuth authentication flows for MCP servers
 */
export class OAuthManager {
	private activeFlows: Map<string, OAuthFlow> = new Map();
	private readonly flowTimeout = 300000;

	/**
	 * Detect OAuth requirements from MCP server output
	 */
	detectOAuthFromOutput(output: string): {
		requiresAuth: boolean;
		authUrl?: string;
		callbackPort?: number;
		state?: string;
	} {
		const authUrlMatch =
			output.match(/Please authorize.*?visiting:\s*(https?:\/\/[^\s\n]+)/i) ||
			output.match(/Authorization URL:\s*(https?:\/\/[^\s\n]+)/i) ||
			output.match(/Visit:\s*(https?:\/\/[^\s\n]+)/i) ||
			output.match(/Open:\s*(https?:\/\/[^\s\n]+)/i) ||
			output.match(/(https?:\/\/[^\s\n]*authorize[^\s\n]*)/i) ||
			output.match(/Browser opened automatically/i) ||
			output.match(/Authentication required/i) ||
			output.match(/auth.*needed/i) ||
			output.match(/oauth.*callback/i);

		const oauthUrlMatch = output.match(
			/(https?:\/\/[^\s\n]*(?:oauth|auth|authorize|login)[^\s\n]*)/i
		);

		let authUrl: string | undefined;

		if (authUrlMatch && authUrlMatch[1] && authUrlMatch[1].startsWith("http")) {
			authUrl = authUrlMatch[1];
		} else if (oauthUrlMatch && oauthUrlMatch[1]) {
			authUrl = oauthUrlMatch[1];
		}

		const authKeywords = [
			/authentication required/i,
			/authorization.*needed/i,
			/please.*authorize/i,
			/browser.*opened/i,
			/oauth.*flow/i,
			/waiting.*authorization/i,
		];

		const hasAuthKeywords = authKeywords.some((pattern) =>
			pattern.test(output)
		);

		if (!authUrl && !hasAuthKeywords) {
			return { requiresAuth: false };
		}

		const portMatch =
			output.match(/port:?\s*(\d+)/i) ||
			output.match(/localhost:(\d+)/i) ||
			output.match(/127\.0\.0\.1:(\d+)/i);

		const callbackPort = portMatch ? parseInt(portMatch[1], 10) : undefined;

		const stateMatch = authUrl?.match(/[?&]state=([^&\s]+)/);
		const state = stateMatch ? stateMatch[1] : undefined;

		return {
			requiresAuth: true,
			authUrl,
			callbackPort,
			state,
		};
	}

	/**
	 * Start OAuth flow by opening browser
	 */
	async startOAuthFlow(
		clientId: string,
		authUrl: string,
		callbackPort?: number,
		state?: string
	): Promise<void> {
		this.cleanupFlow(clientId);

		const flow: OAuthFlow = {
			clientId,
			authUrl,
			callbackPort,
			state,
			timestamp: Date.now(),
		};

		this.activeFlows.set(clientId, flow);

		try {
			window.open(authUrl, "_blank");
		} catch (error) {
			console.error(`Failed to open OAuth URL for ${clientId}:`, error);
			this.cleanupFlow(clientId);
			throw new Error(`Failed to open authorization URL: ${error}`);
		}

		setTimeout(() => {
			if (this.activeFlows.has(clientId)) {
				console.warn(`OAuth flow for ${clientId} timed out`);
				this.cleanupFlow(clientId);
			}
		}, this.flowTimeout);
	}

	/**
	 * Check if a client has an active OAuth flow
	 */
	hasActiveFlow(clientId: string): boolean {
		const flow = this.activeFlows.get(clientId);
		if (!flow) return false;

		if (Date.now() - flow.timestamp > this.flowTimeout) {
			this.cleanupFlow(clientId);
			return false;
		}

		return true;
	}

	/**
	 * Get OAuth flow information for a client
	 */
	getFlow(clientId: string): OAuthFlow | undefined {
		return this.activeFlows.get(clientId);
	}

	/**
	 * Mark OAuth flow as completed and clean up
	 */
	completeFlow(clientId: string): void {
		this.cleanupFlow(clientId);
	}

	/**
	 * Clean up OAuth flow for a client
	 */
	private cleanupFlow(clientId: string): void {
		this.activeFlows.delete(clientId);
	}

	/**
	 * Clean up all expired flows
	 */
	cleanupExpiredFlows(): void {
		const now = Date.now();
		for (const [clientId, flow] of this.activeFlows.entries()) {
			if (now - flow.timestamp > this.flowTimeout) {
				this.cleanupFlow(clientId);
			}
		}
	}

	/**
	 * Get all active OAuth flows
	 */
	getActiveFlows(): Array<{
		clientId: string;
		authUrl: string;
		timestamp: number;
	}> {
		return Array.from(this.activeFlows.values()).map((flow) => ({
			clientId: flow.clientId,
			authUrl: flow.authUrl,
			timestamp: flow.timestamp,
		}));
	}

	/**
	 * Shutdown and clean up all flows
	 */
	shutdown(): void {
		this.activeFlows.clear();
	}
}
