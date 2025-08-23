import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { MCPClientConfig, MCP_TRANSPORT_TYPE } from "../types/Settings";
import { CommandResolver } from "../utils/CommandResolver";
import { StdioTransportFactory } from "./StdioTransportFactory";

export class MCPTransportFactory {
	private commandResolver: CommandResolver;
	private stdioFactory: StdioTransportFactory;

	constructor() {
		this.commandResolver = new CommandResolver();
		this.stdioFactory = new StdioTransportFactory(this.commandResolver);
	}

	async createTransport(config: MCPClientConfig): Promise<Transport> {
		switch (config.transport.type) {
			case MCP_TRANSPORT_TYPE.STDIO:
				if (!config.transport.command) {
					throw new Error(
						`STDIO transport requires command for client ${config.name}`
					);
				}
				return this.stdioFactory.create(config);

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
}
