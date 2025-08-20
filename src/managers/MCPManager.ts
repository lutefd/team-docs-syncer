import { experimental_createMCPClient } from "ai";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type TeamDocsPlugin from "../../main";
import { MCPClientConfig, MCP_TRANSPORT_TYPE } from "../types/Settings";
import { OAuthManager } from "./OAuthManager";
import { exec } from "child_process";
import { promisify } from "util";
import { Notice } from "obsidian";

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
	private clientConfigs: Map<string, MCPClientConfig> = new Map();
	private retryAttempts: Map<string, number> = new Map();
	private shownPermissionNotices: Set<string> = new Set();
	private oauthManager: OAuthManager;
	private readonly maxRetries = 3;
	private readonly retryDelay = 1000;
	private readonly cacheTimeout = 30000;
	private reconnectionTimers: Map<string, NodeJS.Timeout> = new Map();
	private readonly reconnectionDelay = 5000;
	private connectionAttempts: Map<string, number> = new Map();
	private toolsCache: Map<string, { tools: any[]; timestamp: number }> =
		new Map();

	constructor(plugin: TeamDocsPlugin) {
		this.plugin = plugin;
		this.oauthManager = new OAuthManager();
	}

	/**
	 * Initialize all configured MCP clients
	 */
	async initialize(): Promise<void> {
		const configs = this.plugin.settings.mcpClients;

		for (const config of configs) {
			try {
				if (config.enabled) {
					await this.connectClient(config);
				} else {
					if (config.transport.type !== MCP_TRANSPORT_TYPE.STDIO) {
						await this.testConnection(config);
					}
				}
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

		if (command === "npx") {
			const nodePath = await this.resolveCommandPath("node");
			const npxPath = nodePath.replace("/node", "/npx");

			try {
				const fs = require("fs");
				if (fs.existsSync(npxPath)) {
					return npxPath;
				}
			} catch (e) {}
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
					return nvmPath;
				}
			} catch (e) {}
		}

		try {
			const { stdout } = await execAsync(`which ${command}`, { timeout: 5000 });
			const resolvedPath = stdout.trim();

			if (resolvedPath && resolvedPath !== command) {
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
						return path;
					}
				} catch (e) {}
			}
		}

		return command;
	}

	/**
	 * Create transport based on configuration with enhanced filtering
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

				return this.createRobustStdioTransport(config, resolvedCommand);

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
	 * Create a robust STDIO transport that handles MCP servers with debug output
	 */
	private createRobustStdioTransport(
		config: MCPClientConfig,
		command: string
	): Transport {
		const { spawn } = require("child_process");

		const args = config.transport.args ? config.transport.args.split(" ") : [];

		const commandDir = command.includes("/")
			? command.substring(0, command.lastIndexOf("/"))
			: "";
		const enhancedPath = commandDir
			? `${commandDir}:${process.env.PATH}`
			: process.env.PATH;

		const child = spawn(command, args, {
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				PATH: enhancedPath,
				NODE_ENV: "production",
				DEBUG: "",
				VERBOSE: "",
			},
		});

		let allStdoutOutput = "";
		let allStderrOutput = "";

		child.stderr.on("data", (data: Buffer) => {
			const output = data.toString();
			allStderrOutput += output;

			this.handleOAuthDetection(config, output);
			this.handlePermissionError(config, output);
		});

		let messageBuffer = "";
		const messageQueue: string[] = [];
		let onMessageCallback: ((data: any) => void) | null = null;

		child.stdout.on("data", (data: Buffer) => {
			const chunk = data.toString();
			allStdoutOutput += chunk;
			messageBuffer += chunk;

			this.handleOAuthDetection(config, chunk);

			this.extractJsonRpcMessages(messageBuffer, messageQueue);

			messageBuffer = this.cleanBuffer(messageBuffer);

			while (messageQueue.length > 0 && onMessageCallback) {
				const message = messageQueue.shift()!;
				try {
					const parsedMessage = JSON.parse(message);
					onMessageCallback(parsedMessage);
				} catch (error) {
					console.error(`Error processing MCP message:`, error);
				}
			}
		});

		const transport: Transport = {
			onmessage: undefined,
			onerror: undefined,
			onclose: undefined,

			start: async () => {},

			send: async (message: any) => {
				const jsonMessage = JSON.stringify(message) + "\n";
				child.stdin.write(jsonMessage);
			},

			close: async () => {
				child.kill();
			},
		};

		Object.defineProperty(transport, "onmessage", {
			set: (callback: (data: any) => void) => {
				onMessageCallback = callback;
				while (messageQueue.length > 0 && callback) {
					const message = messageQueue.shift()!;
					try {
						const parsedMessage = JSON.parse(message);
						callback(parsedMessage);
					} catch (error) {
						console.error(`Error processing queued MCP message:`, error);
					}
				}
			},
			get: () => onMessageCallback,
		});

		child.on("error", (error: Error) => {
			this.handleOAuthDetection(config, allStdoutOutput + allStderrOutput);

			if (transport.onerror) {
				transport.onerror(error);
			}
		});

		child.on("close", (code: number) => {
			this.handleOAuthDetection(config, allStdoutOutput + allStderrOutput);

			if (transport.onclose) {
				transport.onclose();
			}
		});

		return transport;
	}

	/**
	 * Extract valid JSON-RPC messages from a buffer containing mixed output
	 */
	private extractJsonRpcMessages(buffer: string, messageQueue: string[]): void {
		const lines = buffer.split("\n");

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			if (this.isDebugLine(trimmed)) {
				continue;
			}

			if (!trimmed.startsWith("{")) {
				continue;
			}

			try {
				const parsed = JSON.parse(trimmed);

				if (this.isValidJsonRpc(parsed)) {
					messageQueue.push(trimmed);
				}
			} catch (error) {
				continue;
			}
		}
	}

	/**
	 * Clean buffer by removing processed lines
	 */
	private cleanBuffer(buffer: string): string {
		const lines = buffer.split("\n");
		return lines[lines.length - 1] || "";
	}

	/**
	 * Check if a line looks like debug output
	 */
	private isDebugLine(line: string): boolean {
		const debugPatterns = [
			/^(DEBUG|INFO|WARN|ERROR|TRACE):/i,
			/^console\./i,
			/^Loading/i,
			/^Initializing/i,
			/^Starting/i,
			/^Found/i,
			/^Processing/i,
			/^\[.*\]/,
			/^\d{4}-\d{2}-\d{2}/,
			/^[A-Za-z]+\s+\d+/,
		];

		return debugPatterns.some((pattern) => pattern.test(line));
	}

	/**
	 * Validate if an object is a valid JSON-RPC message
	 */
	private isValidJsonRpc(obj: any): boolean {
		if (typeof obj !== "object" || obj === null) {
			return false;
		}

		if (obj.jsonrpc === "2.0") {
			return true;
		}

		return (
			typeof obj.id !== "undefined" ||
			typeof obj.method === "string" ||
			typeof obj.result !== "undefined" ||
			typeof obj.error !== "undefined"
		);
	}

	/**
	 * Handle OAuth detection from MCP server output
	 */
	private async handleOAuthDetection(
		config: MCPClientConfig,
		output: string
	): Promise<void> {
		const oauthInfo = this.oauthManager.detectOAuthFromOutput(output);

		if (oauthInfo.requiresAuth) {
			if (oauthInfo.authUrl) {
				if (!this.oauthManager.hasActiveFlow(config.id)) {
					try {
						await this.oauthManager.startOAuthFlow(
							config.id,
							oauthInfo.authUrl,
							oauthInfo.callbackPort,
							oauthInfo.state
						);
					} catch (error) {
						console.error(
							`Failed to start OAuth flow for ${config.name}:`,
							error
						);
					}
				} else {
					console.warn(`OAuth flow already active for ${config.name}`);
				}
			} else {
				console.warn(
					`OAuth required for ${config.name} but no authorization URL found. Output:`,
					output.substring(0, 500)
				);
			}
		}
	}

	/**
	 * Handle permission/access errors in MCP server output
	 */
	private handlePermissionError(config: MCPClientConfig, output: string): void {
		const accessDeniedPattern =
			/Error POSTing to endpoint \(HTTP 403\):\s*(.+?)(?:\n|$)/i;
		const linkPattern = /Link:\s*(https?:\/\/[^\s]+)/i;
		const descriptionPattern = /Description:\s*(.+?)(?:\n|$)/i;

		const accessMatch = output.match(accessDeniedPattern);
		if (accessMatch) {
			const errorMessage = accessMatch[1];
			const linkMatch = output.match(linkPattern);
			const descriptionMatch = output.match(descriptionPattern);

			const noticeKey = `${config.name}:${
				linkMatch ? linkMatch[1] : errorMessage
			}`;

			if (this.shownPermissionNotices.has(noticeKey)) {
				return;
			}

			this.shownPermissionNotices.add(noticeKey);

			const notice = {
				title: `Access Permission Required - ${config.name}`,
				message: errorMessage,
				requestUrl: linkMatch ? linkMatch[1] : null,
				description: descriptionMatch ? descriptionMatch[1] : null,
				timestamp: new Date().toISOString(),
				clientName: config.name,
			};

			this.showPermissionNotice(notice);
		}
	}

	/**
	 * Show a permission notice to the user
	 */
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

	/**
	 * Check if an error should trigger automatic reconnection
	 */
	private shouldReconnect(error: Error): boolean {
		const message = error.message.toLowerCase();
		return (
			message.includes("sse stream disconnected") ||
			message.includes("network error") ||
			message.includes("err_network_changed") ||
			message.includes("connection lost") ||
			message.includes("aborted")
		);
	}

	/**
	 * Schedule automatic reconnection for a client
	 */
	private scheduleReconnection(config: MCPClientConfig): void {
		const existingTimer = this.reconnectionTimers.get(config.id);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		const timer = setTimeout(async () => {
			try {
				await this.connectClient(config);
			} catch (error) {
				console.error(`Reconnection failed for ${config.name}:`, error);
			}
			this.reconnectionTimers.delete(config.id);
		}, this.reconnectionDelay);

		this.reconnectionTimers.set(config.id, timer);
	}

	/**
	 * Test connection to an MCP client without keeping it connected
	 */
	async testConnection(config: MCPClientConfig): Promise<boolean> {
		try {
			const transport = await this.createTransport(config);
			const client = await experimental_createMCPClient({ transport });

			await client.tools();

			await transport.close();

			return true;
		} catch (error) {
			console.error(`Connection test failed for ${config.name}:`, error);
			return false;
		}
	}

	/**
	 * Connect to an MCP client
	 */
	async connectClient(config: MCPClientConfig): Promise<void> {
		const existing = this.clients.get(config.id);
		if (existing && existing.connected) {
			return;
		}

		if (this.clients.has(config.id)) {
			await this.disconnectClient(config.id);
		}

		try {
			const transport = await this.createTransport(config);

			const originalOnMessage = transport.onmessage;
			let messageBuffer = "";

			transport.onmessage = (data: any) => {
				if (typeof data === "string") {
					messageBuffer += data;

					let processedUpTo = 0;

					for (let i = 0; i < messageBuffer.length; i++) {
						const char = messageBuffer[i];

						if (char === "{") {
							let braceCount = 1;
							let jsonStart = i;
							let j = i + 1;
							let inString = false;
							let escaped = false;

							while (j < messageBuffer.length && braceCount > 0) {
								const currentChar = messageBuffer[j];

								if (escaped) {
									escaped = false;
								} else if (currentChar === "\\") {
									escaped = true;
								} else if (currentChar === '"' && !escaped) {
									inString = !inString;
								} else if (!inString) {
									if (currentChar === "{") {
										braceCount++;
									} else if (currentChar === "}") {
										braceCount--;
									}
								}
								j++;
							}

							if (braceCount === 0) {
								const potentialJson = messageBuffer.substring(jsonStart, j);

								try {
									const parsed = JSON.parse(potentialJson);

									if (
										parsed.jsonrpc === "2.0" ||
										typeof parsed.id !== "undefined" ||
										parsed.method ||
										parsed.result !== undefined ||
										parsed.error !== undefined
									) {
										if (originalOnMessage) {
											originalOnMessage.call(transport, potentialJson);
										}
									}
								} catch (parseError) {}

								processedUpTo = j;
								i = j - 1;
							}
						}
					}

					if (processedUpTo > 0) {
						messageBuffer = messageBuffer.substring(processedUpTo);
					}

					if (messageBuffer.length > 50000) {
						messageBuffer = "";
					}
				} else {
					if (originalOnMessage) {
						originalOnMessage.call(transport, data);
					}
				}
			};

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
				instance.connected = false;

				if (config.enabled) {
					this.scheduleReconnection(config);
				}
			};

			transport.onerror = (error: Error) => {
				console.error(`MCP client ${config.name} error:`, error);
				instance.lastError = error.message;
				instance.connected = false;

				if (config.enabled && this.shouldReconnect(error)) {
					this.scheduleReconnection(config);
				}
			};

			this.clients.set(config.id, instance);
			this.connectionAttempts.delete(config.id);
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

		const timer = this.reconnectionTimers.get(clientId);
		if (timer) {
			clearTimeout(timer);
			this.reconnectionTimers.delete(clientId);
		}

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
		this.toolsCache.delete(clientId);
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
	 * List available tools from all connected clients with caching
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
				if (!existing || !existing.connected) {
					await this.connectClient(config);
				} else {
					const criticalConfigChanged =
						existing.config.transport.type !== config.transport.type ||
						existing.config.transport.command !== config.transport.command ||
						existing.config.transport.url !== config.transport.url ||
						existing.config.transport.args !== config.transport.args;

					if (criticalConfigChanged) {
						await this.connectClient(config);
					}
				}
			}
		}
	}

	/**
	 * Get OAuth status for all clients
	 */
	getOAuthStatus(): Array<{
		clientId: string;
		clientName: string;
		hasActiveFlow: boolean;
		authUrl?: string;
		timestamp?: number;
	}> {
		const activeFlows = this.oauthManager.getActiveFlows();
		const result: Array<{
			clientId: string;
			clientName: string;
			hasActiveFlow: boolean;
			authUrl?: string;
			timestamp?: number;
		}> = [];

		for (const client of this.clients.values()) {
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

	/**
	 * Complete OAuth flow for a client
	 */
	completeOAuthFlow(clientId: string): void {
		this.oauthManager.completeFlow(clientId);
	}

	/**
	 * Shutdown all clients
	 */
	async shutdown(): Promise<void> {
		for (const timer of this.reconnectionTimers.values()) {
			clearTimeout(timer);
		}
		this.reconnectionTimers.clear();

		this.oauthManager.shutdown();

		const disconnectPromises = Array.from(this.clients.keys()).map((clientId) =>
			this.disconnectClient(clientId)
		);

		await Promise.allSettled(disconnectPromises);
		this.clients.clear();
		this.connectionAttempts.clear();
		this.toolsCache.clear();
	}
}
