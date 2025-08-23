import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { MCPClientConfig } from "../types/Settings";
import { CommandResolver } from "../utils/CommandResolver";
import { JsonRpcMessageProcessor } from "../utils/JsonRpcMessageProcessor";
import { MCPOutputHandler } from "../utils/MCPOutputHandler";

export class StdioTransportFactory {
	constructor(private commandResolver: CommandResolver) {}

	async create(config: MCPClientConfig): Promise<Transport> {
		const resolvedCommand = await this.commandResolver.resolveCommandPath(
			config.transport.command!
		);

		return this.createRobustStdioTransport(config, resolvedCommand);
	}

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

		const outputHandler = new MCPOutputHandler(config);
		const messageProcessor = new JsonRpcMessageProcessor();

		let allStdoutOutput = "";
		let allStderrOutput = "";

		child.stderr.on("data", (data: Buffer) => {
			const output = data.toString();
			allStderrOutput += output;
			outputHandler.handleOutput(output);
		});

		child.stdout.on("data", (data: Buffer) => {
			const chunk = data.toString();
			allStdoutOutput += chunk;
			outputHandler.handleOutput(chunk);
			messageProcessor.processChunk(chunk);
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
				messageProcessor.setMessageCallback(callback);
			},
			get: () => messageProcessor.getMessageCallback(),
		});

		child.on("error", (error: Error) => {
			outputHandler.handleOutput(allStdoutOutput + allStderrOutput);
			if (transport.onerror) {
				transport.onerror(error);
			}
		});

		child.on("close", (code: number) => {
			outputHandler.handleOutput(allStdoutOutput + allStderrOutput);
			if (transport.onclose) {
				transport.onclose();
			}
		});

		return transport;
	}
}
