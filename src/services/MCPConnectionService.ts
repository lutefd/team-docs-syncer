import { experimental_createMCPClient } from "ai";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { MCPClientConfig } from "../types/Settings";
import { MCPTransportFactory } from "../factories/MCPTransportFactory";

interface MCPClientInstance {
	id: string;
	name: string;
	config: MCPClientConfig;
	transport: Transport;
	client: any;
	connected: boolean;
	lastError?: string;
}

export class MCPConnectionService {
	private clients: Map<string, MCPClientInstance> = new Map();
	private transportFactory: MCPTransportFactory;
	private reconnectionTimers: Map<string, NodeJS.Timeout> = new Map();
	private connectionAttempts: Map<string, number> = new Map();
	private readonly maxRetries = 3;
	private readonly reconnectionDelay = 5000;

	constructor() {
		this.transportFactory = new MCPTransportFactory();
	}

	async connectClient(config: MCPClientConfig): Promise<void> {
		const existing = this.clients.get(config.id);
		if (existing && existing.connected) {
			return;
		}

		if (this.clients.has(config.id)) {
			await this.disconnectClient(config.id);
		}

		try {
			const transport = await this.transportFactory.createTransport(config);
			const client = await experimental_createMCPClient({ transport });

			const instance: MCPClientInstance = {
				id: config.id,
				name: config.name,
				config,
				transport,
				client,
				connected: true,
			};

			this.setupTransportEventHandlers(instance);
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
	}

	async testConnection(config: MCPClientConfig): Promise<boolean> {
		try {
			const transport = await this.transportFactory.createTransport(config);
			const client = await experimental_createMCPClient({ transport });
			await client.tools();
			await transport.close();
			return true;
		} catch (error) {
			console.error(`Connection test failed for ${config.name}:`, error);
			return false;
		}
	}

	getClient(clientId: string): MCPClientInstance | undefined {
		return this.clients.get(clientId);
	}

	getConnectedClients(): MCPClientInstance[] {
		return Array.from(this.clients.values()).filter(
			(client) => client.connected
		);
	}

	private setupTransportEventHandlers(instance: MCPClientInstance): void {
		instance.transport.onclose = () => {
			instance.connected = false;
			if (instance.config.enabled) {
				this.scheduleReconnection(instance.config);
			}
		};

		instance.transport.onerror = (error: Error) => {
			console.error(`MCP client ${instance.config.name} error:`, error);
			instance.lastError = error.message;
			instance.connected = false;

			if (instance.config.enabled && this.shouldReconnect(error)) {
				this.scheduleReconnection(instance.config);
			}
		};
	}

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

	async shutdown(): Promise<void> {
		for (const timer of this.reconnectionTimers.values()) {
			clearTimeout(timer);
		}
		this.reconnectionTimers.clear();

		const disconnectPromises = Array.from(this.clients.keys()).map((clientId) =>
			this.disconnectClient(clientId)
		);

		await Promise.allSettled(disconnectPromises);
		this.clients.clear();
		this.connectionAttempts.clear();
	}
}
