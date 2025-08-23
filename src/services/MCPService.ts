import type TeamDocsPlugin from "../../main";
import { MCPClientConfig, MCP_TRANSPORT_TYPE } from "../types/Settings";
import { OAuthService } from "./OAuthService";
import { MCPConnectionService } from "./MCPConnectionService";

export class MCPService {
	private plugin: TeamDocsPlugin;
	private connectionManager: MCPConnectionService;
	private oauthManager: OAuthService;
	private toolsCache: Map<string, { tools: any[]; timestamp: number }> =
		new Map();
	private readonly cacheTimeout = 30000;

	constructor(plugin: TeamDocsPlugin) {
		this.plugin = plugin;
		this.connectionManager = new MCPConnectionService();
		this.oauthManager = new OAuthService();
	}

	async initialize(): Promise<void> {
		const configs = this.plugin.settings.mcpClients;

		for (const config of configs) {
			try {
				if (config.enabled) {
					await this.connectionManager.connectClient(config);
				} else {
					if (config.transport.type !== MCP_TRANSPORT_TYPE.STDIO) {
						await this.connectionManager.testConnection(config);
					}
				}
			} catch (error) {
				console.error(`Failed to initialize MCP client ${config.name}:`, error);
			}
		}
	}

	async connectClient(config: MCPClientConfig): Promise<void> {
		return this.connectionManager.connectClient(config);
	}

	async disconnectClient(clientId: string): Promise<void> {
		return this.connectionManager.disconnectClient(clientId);
	}

	async testConnection(config: MCPClientConfig): Promise<boolean> {
		return this.connectionManager.testConnection(config);
	}

	getConnectedClients() {
		return this.connectionManager.getConnectedClients();
	}

	getClient(clientId: string) {
		return this.connectionManager.getClient(clientId);
	}

	getClientStatus() {
		return this.connectionManager.getConnectedClients().map((client) => ({
			id: client.id,
			name: client.name,
			connected: client.connected,
			lastError: client.lastError,
			transportType: client.config.transport.type,
		}));
	}

	async listAllResources(): Promise<
		Array<{
			clientId: string;
			clientName: string;
			resources: any[];
		}>
	> {
		const results: Array<{
			clientId: string;
			clientName: string;
			resources: any[];
		}> = [];

		for (const client of this.getConnectedClients()) {
			try {
				const resources = await client.client.listResources();
				results.push({
					clientId: client.id,
					clientName: client.name,
					resources: resources || [],
				});
			} catch (error) {
				console.error(`Failed to list resources for ${client.name}:`, error);
				results.push({
					clientId: client.id,
					clientName: client.name,
					resources: [],
				});
			}
		}

		return results;
	}

	async listAllTools(): Promise<
		Array<{
			clientId: string;
			clientName: string;
			tools: any[];
		}>
	> {
		const results: Array<{
			clientId: string;
			clientName: string;
			tools: any[];
		}> = [];

		for (const client of this.getConnectedClients()) {
			const now = Date.now();
			const cached = this.toolsCache.get(client.id);

			if (cached && now - cached.timestamp < this.cacheTimeout) {
				results.push({
					clientId: client.id,
					clientName: client.name,
					tools: cached.tools,
				});
				continue;
			}

			try {
				const toolSet = await client.client.tools();
				const tools: any[] = [];
				if (toolSet && typeof toolSet === "object") {
					for (const [toolName, toolDef] of Object.entries(toolSet)) {
						const tool = toolDef as any;
						tools.push({
							name: toolName,
							description:
								tool.description || `Tool ${toolName} from ${client.name}`,
							inputSchema: tool.parameters || {
								type: "object",
								properties: {},
							},
							execute: tool.execute,
						});
					}
				}

				this.toolsCache.set(client.id, { tools, timestamp: now });

				results.push({
					clientId: client.id,
					clientName: client.name,
					tools: tools,
				});
			} catch (error) {
				console.error(`Failed to list tools for ${client.name}:`, error);
				results.push({
					clientId: client.id,
					clientName: client.name,
					tools: [],
				});
			}
		}

		return results;
	}

	async readResource(clientId: string, uri: string): Promise<any> {
		const client = this.getClient(clientId);
		if (!client || !client.connected) {
			throw new Error(`Client ${clientId} not found or not connected`);
		}

		try {
			return await client.client.readResource({ uri });
		} catch (error) {
			console.error(
				`Failed to read resource ${uri} from ${client.name}:`,
				error
			);
			throw error;
		}
	}

	async callTool(clientId: string, toolName: string, args: any): Promise<any> {
		const client = this.getClient(clientId);
		if (!client || !client.connected) {
			throw new Error(`Client ${clientId} not found or not connected`);
		}

		try {
			return await client.client.callTool({
				name: toolName,
				arguments: args,
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			if (
				errorMessage.includes("JSON") &&
				errorMessage.includes("position") &&
				typeof args === "string"
			) {
				try {
					const parsedArgs = JSON.parse(args);
					return await client.client.callTool({
						name: toolName,
						arguments: parsedArgs,
					});
				} catch (retryError) {
					console.error(
						`Retry with parsed JSON also failed for tool ${toolName} on ${client.name}:`,
						retryError
					);
					throw retryError;
				}
			}

			console.error(
				`Failed to call tool ${toolName} on ${client.name}:`,
				error
			);
			throw error;
		}
	}

	async refreshClients(): Promise<void> {
		const currentConfigs = this.plugin.settings.mcpClients;
		const currentIds = new Set(currentConfigs.map((c) => c.id));
		const connectedIds = new Set(
			this.connectionManager.getConnectedClients().map((c) => c.id)
		);

		for (const clientId of connectedIds) {
			const config = currentConfigs.find((c) => c.id === clientId);
			if (!config || !config.enabled) {
				await this.connectionManager.disconnectClient(clientId);
			}
		}

		for (const config of currentConfigs) {
			if (config.enabled) {
				const existing = this.connectionManager.getClient(config.id);
				if (!existing || !existing.connected) {
					await this.connectionManager.connectClient(config);
				} else {
					const criticalConfigChanged =
						existing.config.transport.type !== config.transport.type ||
						existing.config.transport.command !== config.transport.command ||
						existing.config.transport.url !== config.transport.url ||
						existing.config.transport.args !== config.transport.args;

					if (criticalConfigChanged) {
						await this.connectionManager.connectClient(config);
					}
				}
			}
		}
	}

	getOAuthStatus() {
		const activeFlows = this.oauthManager.getActiveFlows();
		const result: Array<{
			clientId: string;
			clientName: string;
			hasActiveFlow: boolean;
			authUrl?: string;
			timestamp?: number;
		}> = [];

		for (const client of this.connectionManager.getConnectedClients()) {
			const flow = activeFlows.find((f) => f.clientId === client.id);
			result.push({
				clientId: client.id,
				clientName: client.name,
				hasActiveFlow: !!flow,
				authUrl: flow?.authUrl,
				timestamp: flow?.timestamp,
			});
		}

		return result;
	}

	completeOAuthFlow(clientId: string): void {
		this.oauthManager.completeFlow(clientId);
	}

	async shutdown(): Promise<void> {
		this.oauthManager.shutdown();
		await this.connectionManager.shutdown();
		this.toolsCache.clear();
	}
}
