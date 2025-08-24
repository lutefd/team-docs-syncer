const createTransportMock = jest.fn();
const createMCPClientMock = jest.fn();

jest.mock("../../src/factories/MCPTransportFactory", () => ({
	MCPTransportFactory: jest.fn().mockImplementation(() => ({
		createTransport: (...args: any[]) => createTransportMock(...args),
	})),
}));

jest.mock("ai", () => ({
	experimental_createMCPClient: (...args: any[]) =>
		createMCPClientMock(...args),
}));

describe("MCPConnectionService", () => {
	const makeTransport = () => ({
		close: jest.fn(async () => {}),
		onclose: undefined as any,
		onerror: undefined as any,
	});

	const makeConfig = (over: Partial<any> = {}) => ({
		id: "c1",
		name: "Client 1",
		enabled: true,
		...over,
	});

	let svc: any;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		jest.resetModules();
		// re-require after mocks
		const {
			MCPConnectionService,
		} = require("../../src/services/MCPConnectionService");
		svc = new MCPConnectionService();

		// default mocks
		createTransportMock.mockImplementation(async () => makeTransport());
		createMCPClientMock.mockImplementation(async ({ transport }: any) => ({
			tools: jest.fn(async () => {}),
			_t: transport,
		}));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test("connectClient creates and stores connected instance with handlers", async () => {
		const cfg = makeConfig();
		await svc.connectClient(cfg);
		const inst = svc.getClient(cfg.id);
		expect(inst).toBeDefined();
		expect(inst.connected).toBe(true);
		expect(typeof inst.transport.onclose).toBe("function");
		expect(typeof inst.transport.onerror).toBe("function");
	});

	test("connectClient no-op when already connected", async () => {
		const cfg = makeConfig();
		await svc.connectClient(cfg);
		const disconnectSpy = jest.spyOn(svc, "disconnectClient");
		await svc.connectClient(cfg);
		expect(disconnectSpy).not.toHaveBeenCalled();
		expect(createTransportMock).toHaveBeenCalledTimes(1);
	});

	test("connectClient disconnects stale entry when present but not connected", async () => {
		const cfg = makeConfig();
		const staleTransport = makeTransport();
		(svc as any).clients.set(cfg.id, {
			id: cfg.id,
			name: cfg.name,
			config: cfg,
			transport: staleTransport,
			client: {},
			connected: false,
		});

		const disconnectSpy = jest.spyOn(svc, "disconnectClient");
		await svc.connectClient(cfg);
		expect(disconnectSpy).toHaveBeenCalledWith(cfg.id);
		const inst = svc.getClient(cfg.id);
		expect(inst?.connected).toBe(true);
	});

	test("disconnectClient clears timers, closes transport and removes client", async () => {
		const cfg = makeConfig();
		await svc.connectClient(cfg);
		const inst = svc.getClient(cfg.id)!;

		inst.transport.onerror?.(new Error("network error"));
		const connectSpy = jest.spyOn(svc, "connectClient");

		await svc.disconnectClient(cfg.id);
		jest.advanceTimersByTime(6000);

		expect(connectSpy).not.toHaveBeenCalled();
		expect(inst.transport.close).toHaveBeenCalled();
		expect(svc.getClient(cfg.id)).toBeUndefined();
	});

	test("testConnection returns true on success and false on failure", async () => {
		const {
			MCPConnectionService,
		} = require("../../src/services/MCPConnectionService");
		const s2 = new MCPConnectionService();

		createTransportMock.mockImplementationOnce(async () => makeTransport());
		createMCPClientMock.mockImplementationOnce(async ({ transport }: any) => ({
			tools: jest.fn(async () => {}),
		}));
		await expect(s2.testConnection(makeConfig({ id: "t1" }))).resolves.toBe(
			true
		);

		createTransportMock.mockImplementationOnce(async () => makeTransport());
		createMCPClientMock.mockImplementationOnce(async ({ transport }: any) => ({
			tools: jest.fn(async () => {
				throw new Error("boom");
			}),
		}));
		await expect(s2.testConnection(makeConfig({ id: "t2" }))).resolves.toBe(
			false
		);
	});

	test("getConnectedClients filters by connected state", async () => {
		const cfg = makeConfig();
		await svc.connectClient(cfg);
		let list = svc.getConnectedClients();
		expect(list.map((c: any) => c.id)).toEqual([cfg.id]);

		const inst = svc.getClient(cfg.id)!;
		inst.transport.onclose?.();

		jest.advanceTimersByTime(6000);
		const after = svc.getClient(cfg.id);
		expect(after?.connected).toBe(false);

		list = svc.getConnectedClients();
		expect(list.length).toBe(0);
	});

	test("onclose schedules reconnection when enabled", async () => {
		const cfg = makeConfig({ id: "rc1", enabled: true });
		await svc.connectClient(cfg);
		const inst = svc.getClient(cfg.id)!;

		const connectSpy = jest
			.spyOn(svc, "connectClient")
			.mockResolvedValue(undefined);
		inst.transport.onclose?.();
		jest.advanceTimersByTime(5000);
		expect(connectSpy).toHaveBeenCalledWith(cfg);
	});

	test("onerror schedules reconnection only for retryable errors", async () => {
		const cfg = makeConfig({ id: "e1", enabled: true });
		await svc.connectClient(cfg);
		const inst = svc.getClient(cfg.id)!;

		const connectSpy = jest
			.spyOn(svc, "connectClient")
			.mockResolvedValue(undefined);

		inst.transport.onerror?.(new Error("SSE stream disconnected"));
		jest.advanceTimersByTime(5000);
		expect(connectSpy).toHaveBeenCalledWith(cfg);
		connectSpy.mockClear();

		inst.transport.onerror?.(new Error("random failure"));
		jest.advanceTimersByTime(5000);
		expect(connectSpy).not.toHaveBeenCalled();
	});

	test("shutdown clears timers and disconnects all clients", async () => {
		const a = makeConfig({ id: "a" });
		const b = makeConfig({ id: "b" });
		await svc.connectClient(a);
		await svc.connectClient(b);

		svc.getClient("a").transport.onerror?.(new Error("connection lost"));
		svc.getClient("b").transport.onerror?.(new Error("network error"));

		const aClose = svc.getClient("a").transport.close;
		const bClose = svc.getClient("b").transport.close;

		const connectSpy = jest
			.spyOn(svc, "connectClient")
			.mockResolvedValue(undefined);

		await svc.shutdown();
		jest.advanceTimersByTime(6000);

		expect(connectSpy).not.toHaveBeenCalled();
		expect(aClose).toHaveBeenCalled();
		expect(bClose).toHaveBeenCalled();

		expect(svc.getConnectedClients().length).toBe(0);
	});
});
