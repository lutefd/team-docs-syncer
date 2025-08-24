import { StdioTransportFactory } from "../../src/factories/StdioTransportFactory";
import { CommandResolver } from "../../src/utils/CommandResolver";
import { MCPClientConfig, MCP_TRANSPORT_TYPE } from "../../src/types/Settings";

jest.mock("child_process", () => ({
	spawn: jest.fn(() => {
		const handlers: any = { stdout: [], stderr: [], close: null, error: null };
		return {
			stdin: { write: jest.fn() },
			stdout: { on: (e: string, cb: any) => handlers.stdout.push(cb) },
			stderr: { on: (e: string, cb: any) => handlers.stderr.push(cb) },
			on: (e: string, cb: any) => {
				if (e === "close") handlers.close = cb;
				if (e === "error") handlers.error = cb;
			},
			__handlers: handlers,
			kill: jest.fn(),
		} as any;
	}),
}));

jest.mock("../../src/utils/CommandResolver", () => ({
	CommandResolver: jest.fn().mockImplementation(() => ({
		resolveCommandPath: jest.fn(async (cmd: string) => `/bin/${cmd}`),
	})),
}));

function makeConfig(): MCPClientConfig {
	return {
		id: "id1",
		name: "server",
		enabled: true,
		transport: {
			type: MCP_TRANSPORT_TYPE.STDIO,
			command: "node",
			args: "server.js",
			url: "",
		},
	} as any;
}

describe("StdioTransportFactory", () => {
	test("creates transport and forwards send/close, aggregates output", async () => {
		const cr = new CommandResolver();
		const f = new StdioTransportFactory(cr);
		const config = makeConfig();
		const transport: any = await f.create(config);

		await transport.send({ hello: "world" });
		const spawn = require("child_process").spawn as jest.Mock;
		const child = spawn.mock.results[0].value;
		expect(child.stdin.write).toHaveBeenCalledWith(
			JSON.stringify({ hello: "world" }) + "\n"
		);

		const msgCb = jest.fn();
		transport.onmessage = msgCb;
		child.__handlers.stdout.forEach((cb: any) =>
			cb(Buffer.from('{"jsonrpc":"2.0","id":1}'))
		);
		await Promise.resolve();
		expect(msgCb).toHaveBeenCalledWith({ jsonrpc: "2.0", id: 1 });

		const closeCb = jest.fn();
		transport.onclose = closeCb;
		await transport.close();
		expect(child.kill).toHaveBeenCalled();
		if (child.__handlers.close) child.__handlers.close(0);
		expect(closeCb).toHaveBeenCalled();
	});
});
