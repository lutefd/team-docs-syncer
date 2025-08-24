describe("OAuthService", () => {
	let svc: any;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date(0));
		jest.clearAllMocks();

		(global as any).window = (global as any).window || {};
		(window as any).open = jest.fn();

		const { OAuthService } = require("../../src/services/OAuthService");
		svc = new OAuthService();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test("detectOAuthFromOutput: returns false when no url or keywords", () => {
		const res = svc.detectOAuthFromOutput("some normal log line");
		expect(res).toEqual({ requiresAuth: false });
	});

	test("detectOAuthFromOutput: detects URL, state and callback port", () => {
		const text =
			"Please authorize by visiting: https://example.com/oauth/authorize?state=abc123&x=y and then callback at localhost:8080";
		const res = svc.detectOAuthFromOutput(text);
		expect(res.requiresAuth).toBe(true);
		expect(res.authUrl).toBe(
			"https://example.com/oauth/authorize?state=abc123&x=y"
		);
		expect(res.callbackPort).toBe(8080);
		expect(res.state).toBe("abc123");
	});

	test("detectOAuthFromOutput: keywords without url still require auth", () => {
		const res = svc.detectOAuthFromOutput(
			"Authentication required. Waiting for authorization..."
		);
		expect(res.requiresAuth).toBe(true);
		expect(res.authUrl).toBeUndefined();
	});

	test("startOAuthFlow: opens browser, stores flow, and times out", async () => {
		await svc.startOAuthFlow("c1", "https://auth", 3000, "st");

		expect(svc.hasActiveFlow("c1")).toBe(true);
		const flow = svc.getFlow("c1");
		expect(flow.authUrl).toBe("https://auth");
		expect(window.open).toHaveBeenCalledWith("https://auth", "_blank");

		jest.advanceTimersByTime(299000);
		expect(svc.hasActiveFlow("c1")).toBe(true);

		jest.advanceTimersByTime(2000);
		expect(svc.hasActiveFlow("c1")).toBe(false);
	});

	test("startOAuthFlow: if window.open throws, cleans up and rethrows", async () => {
		(window.open as jest.Mock).mockImplementationOnce(() => {
			throw new Error("no window");
		});
		await expect(svc.startOAuthFlow("c1", "https://auth")).rejects.toThrow(
			/Failed to open authorization URL/
		);
		expect(svc.hasActiveFlow("c1")).toBe(false);
	});

	test("hasActiveFlow: returns false and cleans expired flows", async () => {
		await svc.startOAuthFlow("c1", "https://auth");
		expect(svc.hasActiveFlow("c1")).toBe(true);
		jest.advanceTimersByTime(301000);
		expect(svc.hasActiveFlow("c1")).toBe(false);
		expect(svc.hasActiveFlow("c1")).toBe(false);
	});

	test("cleanupExpiredFlows: removes only those older than timeout", async () => {
		await svc.startOAuthFlow("old", "https://old");
		jest.advanceTimersByTime(100000);
		await svc.startOAuthFlow("new", "https://new");
		jest.advanceTimersByTime(299000);

		svc.cleanupExpiredFlows();
		const active = svc.getActiveFlows().map((f: any) => f.clientId);
		expect(active).toEqual(["new"]);
	});

	test("completeFlow removes flow", async () => {
		await svc.startOAuthFlow("c1", "https://auth");
		expect(svc.hasActiveFlow("c1")).toBe(true);
		svc.completeFlow("c1");
		expect(svc.hasActiveFlow("c1")).toBe(false);
	});

	test("getActiveFlows returns mapped data", async () => {
		await svc.startOAuthFlow("c1", "https://a");
		const flows = svc.getActiveFlows();
		expect(flows.length).toBe(1);
		expect(flows[0].clientId).toBe("c1");
		expect(flows[0].authUrl).toBe("https://a");
		expect(typeof flows[0].timestamp).toBe("number");
	});

	test("shutdown clears all flows", async () => {
		await svc.startOAuthFlow("c1", "https://a");
		await svc.startOAuthFlow("c2", "https://b");
		expect(svc.getActiveFlows().length).toBe(2);
		svc.shutdown();
		expect(svc.getActiveFlows().length).toBe(0);
	});
});
