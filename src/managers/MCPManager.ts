import { experimental_createMCPClient } from "ai";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type TeamDocsPlugin from "../../main";
import { MCPClientConfig, MCP_TRANSPORT_TYPE } from "../types/Settings";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Represents a connected MCP client with its transport and metadata
 */
interface MCPClientInstance {
	id: string;
	name: string;
	config: MCPClientConfig;
	transport: Transport;
	client: any;
	connected: boolean;
	lastError?: string;
}

/**
 * Manager for MCP (Model Context Protocol) clients
 * Handles multiple MCP servers with different transport types (stdio, SSE, HTTP)
 */
export class MCPManager {
	private plugin: TeamDocsPlugin;
	private clients: Map<string, MCPClientInstance> = new Map();
	private connectionAttempts: Map<string, number> = new Map();
	private readonly maxRetries = 3;
	private readonly retryDelay = 1000;

	constructor(plugin: TeamDocsPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Initialize all configured MCP clients
	 */
	async initialize(): Promise<void> {
		const configs = this.plugin.settings.mcpClients.filter(
			(config) => config.enabled
		);

		for (const config of configs) {
			try {
				await this.connectClient(config);
			} catch (error) {
				console.error(`Failed to initialize MCP client ${config.name}:`, error);
			}
		}
	}

	/**
	 * Resolve command path to handle dynamic PATH issues on macOS
	 */
	private async resolveCommandPath(command: string): Promise<string> {
		if (command.startsWith("/")) {
			return command;
		}

		if (command === "node") {
			const fnmPaths = [
				`${process.env.HOME}/.local/state/fnm_multishells`,
				`${process.env.HOME}/.fnm`,
			];

			for (const fnmBase of fnmPaths) {
				try {
					const fs = require("fs");
					if (fs.existsSync(fnmBase)) {
						const dirs = fs.readdirSync(fnmBase);
						for (const dir of dirs) {
							const nodePath = `${fnmBase}/${dir}/bin/node`;
							if (
								fs.existsSync(nodePath) &&
								fs.statSync(nodePath).mode & parseInt("111", 8)
							) {
								console.log(`[MCPManager] Found fnm node at: ${nodePath}`);
								return nodePath;
							}
						}
					}
				} catch (e) {}
			}

			const nvmPath = `${process.env.HOME}/.nvm/current/bin/node`;
			try {
				const fs = require("fs");
				if (
					fs.existsSync(nvmPath) &&
					fs.statSync(nvmPath).mode & parseInt("111", 8)
				) {
					console.log(`[MCPManager] Found nvm node at: ${nvmPath}`);
					return nvmPath;
				}
			} catch (e) {}
		}

		try {
			const { stdout } = await execAsync(`which ${command}`, { timeout: 5000 });
			const resolvedPath = stdout.trim();

			if (resolvedPath && resolvedPath !== command) {
				console.log(`[MCPManager] Resolved '${command}' to: ${resolvedPath}`);
				return resolvedPath;
			}
		} catch (e) {}

		const commonPaths: Record<string, string[]> = {
			node: [
				"/usr/local/bin/node",
				"/opt/homebrew/bin/node",
				"/usr/bin/node",
				"/usr/local/opt/node/bin/node",
			],
			python: [
				"/usr/local/bin/python3",
				"/opt/homebrew/bin/python3",
				"/usr/bin/python3",
				"/usr/local/opt/python/bin/python3",
			],
			python3: [
				"/usr/local/bin/python3",
				"/opt/homebrew/bin/python3",
				"/usr/bin/python3",
				"/usr/local/opt/python/bin/python3",
			],
		};

		const pathsToTry = commonPaths[command];
		if (pathsToTry) {
			for (const path of pathsToTry) {
				try {
					const fs = require("fs");
					if (
						fs.existsSync(path) &&
						fs.statSync(path).mode & parseInt("111", 8)
					) {
						console.log(`[MCPManager] Resolved '${command}' to: ${path}`);
						return path;
					}
				} catch (e) {}
			}
			console.warn(
				`[MCPManager] Could not find '${command}' in common paths, using original command`
			);
		}

		return command;
	}

	/**
	 * Create transport based on configuration
	 */
	private async createTransport(config: MCPClientConfig): Promise<Transport> {
		switch (config.transport.type) {
			case MCP_TRANSPORT_TYPE.STDIO:
				if (!config.transport.command) {
					throw new Error(
						`STDIO transport requires command for client ${config.name}`
					);
				}

				const resolvedCommand = await this.resolveCommandPath(
					config.transport.command
				);

				return new StdioClientTransport({
					command: resolvedCommand,
					args: config.transport.args
						? config.transport.args.split(" ")
						: undefined,
				});

			case MCP_TRANSPORT_TYPE.SSE:
				if (!config.transport.url) {
					throw new Error(
						`SSE transport requires URL for client ${config.name}`
					);
				}
				return new SSEClientTransport(new URL(config.transport.url));

			case MCP_TRANSPORT_TYPE.HTTP:
				if (!config.transport.url) {
					throw new Error(
						`HTTP transport requires URL for client ${config.name}`
					);
				}
				return new StreamableHTTPClientTransport(new URL(config.transport.url));

			default:
				throw new Error(`Unsupported transport type: ${config.transport.type}`);
		}
	}

	/**
	 * Connect to an MCP client
	 */
	async connectClient(config: MCPClientConfig): Promise<void> {
		if (this.clients.has(config.id)) {
			await this.disconnectClient(config.id);
		}

		try {
			const transport = await this.createTransport(config);

			const client = await experimental_createMCPClient({ transport });

			const instance: MCPClientInstance = {
				id: config.id,
				name: config.name,
				config,
				transport,
				client,
				connected: true,
			};

			transport.onclose = () => {
				console.log(`MCP client ${config.name} disconnected`);
				instance.connected = false;
			};

			transport.onerror = (error: Error) => {
				console.error(`MCP client ${config.name} error:`, error);
				instance.lastError = error.message;
				instance.connected = false;
			};

			this.clients.set(config.id, instance);
			this.connectionAttempts.delete(config.id);
			console.log(`MCP client ${config.name} connected successfully`);

			try {
				const toolSet = await client.tools();
				console.log(`MCP client ${config.name} tools:`, toolSet);
			} catch (toolError) {
				console.warn(`Could not list tools for ${config.name}:`, toolError);
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			console.error(
				`Failed to connect MCP client ${config.name}:`,
				errorMessage
			);
			throw error;
		}
	}

	/**
	 * Disconnect an MCP client
	 */
	async disconnectClient(clientId: string): Promise<void> {
		const instance = this.clients.get(clientId);
		if (!instance) return;

		try {
			await instance.transport.close();
		} catch (error) {
			console.error(
				`Error closing transport for client ${instance.name}:`,
				error
			);
		}

		this.clients.delete(clientId);
		this.connectionAttempts.delete(clientId);
	}

	/**
	 * Handle connection errors with retry logic
	 */
	private async handleConnectionError(
		clientId: string,
		error: Error
	): Promise<void> {
		const instance = this.clients.get(clientId);
		if (!instance) return;

		const attempts = this.connectionAttempts.get(clientId) || 0;
		if (attempts < this.maxRetries) {
			this.connectionAttempts.set(clientId, attempts + 1);
			console.log(
				`Retrying connection for ${instance.name} (attempt ${attempts + 1}/${
					this.maxRetries
				})`
			);

			setTimeout(async () => {
				try {
					await this.connectClient(instance.config);
				} catch (retryError) {
					console.error(`Retry failed for ${instance.name}:`, retryError);
				}
			}, this.retryDelay * Math.pow(5, attempts));
		} else {
			console.error(`Max retries exceeded for MCP client ${instance.name}`);
			instance.connected = false;
		}
	}

	/**
	 * Handle disconnection events
	 */
	private handleDisconnection(clientId: string): void {
		const instance = this.clients.get(clientId);
		if (!instance) return;

		if (instance.connected) {
			this.handleConnectionError(clientId, new Error("Connection lost"));
		}
	}

	/**
	 * Get all connected clients
	 */
	getConnectedClients(): MCPClientInstance[] {
		return Array.from(this.clients.values()).filter(
			(client) => client.connected
		);
	}

	/**
	 * Get a specific client by ID
	 */
	getClient(clientId: string): MCPClientInstance | undefined {
		return this.clients.get(clientId);
	}

	/**
	 * Get client status information
	 */
	getClientStatus(): Array<{
		id: string;
		name: string;
		connected: boolean;
		lastError?: string;
		transportType: MCP_TRANSPORT_TYPE;
	}> {
		return Array.from(this.clients.values()).map((client) => ({
			id: client.id,
			name: client.name,
			connected: client.connected,
			lastError: client.lastError,
			transportType: client.config.transport.type,
		}));
	}

	/**
	 * List available resources from all connected clients
	 */
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

	/**
	 * List available tools from all connected clients
	 */
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
			try {
				const toolSet = await client.client.tools();
				console.log(`MCP tools response for ${client.name}:`, toolSet);

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

	/**
	 * Read a resource from a specific client
	 */
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

	/**
	 * Call a tool on a specific client
	 */
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
			console.error(
				`Failed to call tool ${toolName} on ${client.name}:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Refresh client configurations from settings
	 */
	async refreshClients(): Promise<void> {
		const currentConfigs = this.plugin.settings.mcpClients;
		const currentIds = new Set(currentConfigs.map((c) => c.id));
		const connectedIds = new Set(this.clients.keys());

		for (const clientId of connectedIds) {
			const config = currentConfigs.find((c) => c.id === clientId);
			if (!config || !config.enabled) {
				await this.disconnectClient(clientId);
			}
		}

		for (const config of currentConfigs) {
			if (config.enabled) {
				const existing = this.clients.get(config.id);
				if (
					!existing ||
					JSON.stringify(existing.config) !== JSON.stringify(config)
				) {
					await this.connectClient(config);
				}
			}
		}
	}

	/**
	 * Shutdown all clients
	 */
	async shutdown(): Promise<void> {
		const disconnectPromises = Array.from(this.clients.keys()).map((clientId) =>
			this.disconnectClient(clientId)
		);

		await Promise.allSettled(disconnectPromises);
		this.clients.clear();
		this.connectionAttempts.clear();
	}
}
