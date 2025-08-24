import { createMockApp, createMockPlugin } from "../helpers/mockPlugin";
import type { App } from "obsidian";
import { MCP_TRANSPORT_TYPE } from "../../src/types/Settings";

const managerMock = {
	connectClient: jest.fn(),
	disconnectClient: jest.fn(),
	testConnection: jest.fn(),
	getConnectedClients: jest.fn(),
	getClient: jest.fn(),
	shutdown: jest.fn(),
};

const oauthMock = {
	getActiveFlows: jest.fn(
		(): Array<{ clientId: string; authUrl: string; timestamp: number }> => []
	),
	completeFlow: jest.fn(),
	shutdown: jest.fn(),
};

jest.mock("../../src/services/MCPConnectionService", () => ({
	MCPConnectionService: jest.fn().mockImplementation(() => managerMock),
}));

jest.mock("../../src/services/OAuthService", () => ({
	OAuthService: jest.fn().mockImplementation(() => oauthMock),
}));

describe("MCPService", () => {
	let app: App;
	let plugin: any;
	let svc: any;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		for (const k of Object.keys(managerMock)) {
			managerMock[k].mockReset?.();
		}
		for (const k of Object.keys(oauthMock)) {
			oauthMock[k].mockReset?.();
		}

		app = createMockApp();
		plugin = createMockPlugin(app);

		managerMock.getConnectedClients.mockReturnValue([]);

		const { MCPService } = require("../../src/services/MCPService");
		svc = new MCPService(plugin);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	const makeConfig = (over: Partial<any> = {}) => ({
		id: "c1",
		name: "Client 1",
		enabled: true,
		transport: { type: MCP_TRANSPORT_TYPE.SSE, url: "http://x" },
		...over,
	});

	const makeClientInstance = (over: Partial<any> = {}) => ({
		id: "c1",
		name: "Client 1",
		connected: true,
		lastError: undefined,
		config: makeConfig(),
		client: {
			listResources: jest.fn(async () => [{ uri: "res://a" }]),
			tools: jest.fn(async () => ({
				toolA: {
					description: "A",
					parameters: { type: "object", properties: {} },
					execute: jest.fn(),
				},
			})),
			readResource: jest.fn(async (_: any) => ({ ok: true, content: "data" })),
			callTool: jest.fn(async (_: any) => ({ ok: true })),
		},
		transport: {} as any,
		...over,
	});

	test("initialize: connects enabled, tests disabled non-STDIO, skips disabled STDIO", async () => {
		plugin.settings.mcpClients = [
			makeConfig({ id: "a", name: "A", enabled: true }),
			makeConfig({
				id: "b",
				name: "B",
				enabled: false,
				transport: { type: MCP_TRANSPORT_TYPE.SSE, url: "http://b" },
			}),
			makeConfig({
				id: "c",
				name: "C",
				enabled: false,
				transport: { type: MCP_TRANSPORT_TYPE.STDIO, command: "cmd", args: [] },
			}),
		];

		await svc.initialize();

		expect(managerMock.connectClient).toHaveBeenCalledWith(
			plugin.settings.mcpClients[0]
		);
		expect(managerMock.testConnection).toHaveBeenCalledWith(
			plugin.settings.mcpClients[1]
		);
		expect(managerMock.testConnection).not.toHaveBeenCalledWith(
			plugin.settings.mcpClients[2]
		);
	});

	test("wrappers delegate to connection manager", async () => {
		const cfg = makeConfig();

		await svc.connectClient(cfg);
		expect(managerMock.connectClient).toHaveBeenCalledWith(cfg);

		await svc.disconnectClient("x");
		expect(managerMock.disconnectClient).toHaveBeenCalledWith("x");

		managerMock.testConnection.mockResolvedValueOnce(true);
		await expect(svc.testConnection(cfg)).resolves.toBe(true);

		managerMock.getConnectedClients.mockReturnValueOnce([{ id: "k" }]);
		expect(svc.getConnectedClients()).toEqual([{ id: "k" }]);

		managerMock.getClient.mockReturnValueOnce({ id: "x" });
		expect(svc.getClient("x")).toEqual({ id: "x" });
	});

	test("getClientStatus maps fields from connected clients", () => {
		const inst = makeClientInstance({
			id: "z",
			name: "Z",
			lastError: "err",
			config: makeConfig({ id: "z" }),
		});
		managerMock.getConnectedClients.mockReturnValueOnce([inst]);

		const res = svc.getClientStatus();
		expect(res).toEqual([
			{
				id: "z",
				name: "Z",
				connected: true,
				lastError: "err",
				transportType: MCP_TRANSPORT_TYPE.SSE,
			},
		]);
	});

	test("listAllResources aggregates per client and handles errors", async () => {
		const ok = makeClientInstance({ id: "a", name: "A" });
		const bad = makeClientInstance({ id: "b", name: "B" });
		bad.client.listResources = jest.fn(async () => {
			throw new Error("boom");
		});

		managerMock.getConnectedClients.mockReturnValueOnce([ok, bad]);

		const res = await svc.listAllResources();
		expect(res).toEqual([
			{ clientId: "a", clientName: "A", resources: [{ uri: "res://a" }] },
			{ clientId: "b", clientName: "B", resources: [] },
		]);
	});

	test("listAllTools caches results and falls back to [] on error", async () => {
		const inst = makeClientInstance({ id: "a", name: "A" });
		managerMock.getConnectedClients.mockReturnValue([inst]);

		const first = await svc.listAllTools();
		expect(first[0].tools[0].name).toBe("toolA");
		expect(inst.client.tools).toHaveBeenCalledTimes(1);

		const second = await svc.listAllTools();
		expect(second[0].tools[0].name).toBe("toolA");
		expect(inst.client.tools).toHaveBeenCalledTimes(1);

		const bad = makeClientInstance({ id: "b", name: "B" });
		bad.client.tools = jest.fn(async () => {
			throw new Error("nope");
		});
		managerMock.getConnectedClients.mockReturnValueOnce([bad]);

		const res = await svc.listAllTools();
		expect(res[0].tools).toEqual([]);
	});

	test("readResource throws if client not connected or missing", async () => {
		managerMock.getClient.mockReturnValueOnce(undefined);
		await expect(svc.readResource("x", "uri://a")).rejects.toThrow(/not found/);

		const inst = makeClientInstance({ connected: false });
		managerMock.getClient.mockReturnValueOnce(inst);
		await expect(svc.readResource("x", "uri://a")).rejects.toThrow(/not found/);
	});

	test("readResource returns client result and rethrows on error", async () => {
		const inst = makeClientInstance();
		managerMock.getClient.mockReturnValue(inst);

		const ok = await svc.readResource("c1", "uri://a");
		expect(ok).toEqual({ ok: true, content: "data" });

		inst.client.readResource = jest.fn(
			async (_: any): Promise<{ ok: boolean; content: string }> => {
				throw new Error("fail");
			}
		);
		await expect(svc.readResource("c1", "uri://a")).rejects.toThrow("fail");
	});

	test("callTool retries with parsed JSON args on JSON parse errors and returns retry result", async () => {
		const inst = makeClientInstance();
		managerMock.getClient.mockReturnValue(inst);

		const mock = jest.fn(async (req: any) => {
			if (typeof req.arguments === "string") {
				throw new Error("Unexpected token o in JSON at position 1");
			}
			return { ok: true, parsed: req.arguments };
		});
		inst.client.callTool = mock;

		const res = await svc.callTool("c1", "do", '{"x":1}');
		expect(res).toEqual({ ok: true, parsed: { x: 1 } });
		expect(mock).toHaveBeenCalledTimes(2);
	});

	test("callTool retry path logs and rethrows when retry also fails", async () => {
		const inst = makeClientInstance();
		managerMock.getClient.mockReturnValue(inst);

		inst.client.callTool = jest.fn(async (_: any) => {
			throw new Error("Unexpected token : in JSON at position 10");
		});

		await expect(svc.callTool("c1", "do", "{bad json")).rejects.toThrow();
	});

	test("refreshClients disconnects removed/disabled, connects missing/not-connected, and reconnects on critical changes", async () => {
		const a = makeClientInstance({
			id: "a",
			name: "A",
			config: makeConfig({ id: "a" }),
		});
		const b = makeClientInstance({
			id: "b",
			name: "B",
			config: makeConfig({ id: "b" }),
		});
		const d = makeClientInstance({
			id: "d",
			name: "D",
			config: makeConfig({
				id: "d",
				transport: { type: MCP_TRANSPORT_TYPE.SSE, url: "http://old" },
			}),
		});
		const e = makeClientInstance({
			id: "e",
			name: "E",
			connected: false,
			config: makeConfig({ id: "e" }),
		});

		managerMock.getConnectedClients.mockReturnValue([a, b, d, e]);
		managerMock.getClient.mockImplementation(
			(id: string) => (({ a, b, d, e } as any)[id])
		);

		const newConfigs = [
			makeConfig({ id: "a", enabled: true }),
			makeConfig({
				id: "d",
				enabled: true,
				transport: { type: MCP_TRANSPORT_TYPE.SSE, url: "http://new" },
			}),
			makeConfig({ id: "e", enabled: true }),
			makeConfig({ id: "c", enabled: true }),
		];
		plugin.settings.mcpClients = newConfigs;

		await svc.refreshClients();

		expect(managerMock.disconnectClient).toHaveBeenCalledWith("b");
		expect(managerMock.connectClient).not.toHaveBeenCalledWith(
			expect.objectContaining({ id: "a" })
		);

		expect(managerMock.connectClient).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "d",
				transport: expect.objectContaining({ url: "http://new" }),
			})
		);

		expect(managerMock.connectClient).toHaveBeenCalledWith(
			expect.objectContaining({ id: "e" })
		);
		expect(managerMock.connectClient).toHaveBeenCalledWith(
			expect.objectContaining({ id: "c" })
		);
	});

	test("getOAuthStatus maps flows to hasActiveFlow flags", () => {
		const a = makeClientInstance({ id: "a", name: "A" });
		const b = makeClientInstance({ id: "b", name: "B" });
		managerMock.getConnectedClients.mockReturnValueOnce([a, b]);
		oauthMock.getActiveFlows.mockReturnValueOnce([
			{ clientId: "b", authUrl: "http://auth", timestamp: 123 },
		]);

		const res = svc.getOAuthStatus();
		expect(res).toEqual([
			{
				clientId: "a",
				clientName: "A",
				hasActiveFlow: false,
				authUrl: undefined,
				timestamp: undefined,
			},
			{
				clientId: "b",
				clientName: "B",
				hasActiveFlow: true,
				authUrl: "http://auth",
				timestamp: 123,
			},
		]);
	});

	test("completeOAuthFlow delegates and shutdown clears cache and shuts down deps", async () => {
		const inst = makeClientInstance({ id: "a" });
		managerMock.getConnectedClients.mockReturnValue([inst]);
		await svc.listAllTools();

		expect(((svc as any).toolsCache as Map<string, any>).size).toBe(1);

		svc.completeOAuthFlow("a");
		expect(oauthMock.completeFlow).toHaveBeenCalledWith("a");

		await svc.shutdown();
		expect(oauthMock.shutdown).toHaveBeenCalled();
		expect(managerMock.shutdown).toHaveBeenCalled();
		expect(((svc as any).toolsCache as Map<string, any>).size).toBe(0);
	});
});
