const NoticeMock = jest
	.fn()
	.mockImplementation((text: string, _timeout: number) => ({
		noticeEl: {
			style: {} as any,
			innerHTML: String(text),
			addEventListener: jest.fn(),
		},
	}));
jest.mock("obsidian", () => ({ Notice: NoticeMock }));

import {
	MCP_TRANSPORT_TYPE,
	type MCPClientConfig,
} from "../../src/types/Settings";
import { MCPOutputHandler } from "../../src/utils/MCPOutputHandler";

(global as any).navigator = {
	clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
};
(global as any).window = { open: jest.fn() };

describe("MCPOutputHandler", () => {
	const baseConfig: MCPClientConfig = {
		id: "c1",
		name: "ClientOne",
		enabled: true,
		transport: { type: MCP_TRANSPORT_TYPE.STDIO, command: "cmd", args: "" },
	};

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
	});

	test("starts OAuth flow when required and not already active", async () => {
		const handler = new MCPOutputHandler(baseConfig);
		const oauthInstance = {
			detectOAuthFromOutput: jest.fn(() => ({
				requiresAuth: true,
				authUrl: "https://auth",
				callbackPort: 3333,
				state: "abc",
			})),
			hasActiveFlow: jest.fn(() => false),
			startOAuthFlow: jest.fn(async () => {}),
		} as any;
		(handler as any).oauthManager = oauthInstance;

		await handler.handleOutput("Please authorize...");

		expect(oauthInstance.startOAuthFlow).toHaveBeenCalledWith(
			"c1",
			"https://auth",
			3333,
			"abc"
		);
	});

	test("does not start OAuth flow when already active", async () => {
		const handler = new MCPOutputHandler(baseConfig);
		const oauthInstance = {
			detectOAuthFromOutput: jest.fn(() => ({
				requiresAuth: true,
				authUrl: "https://auth2",
				callbackPort: 4444,
				state: "st",
			})),
			hasActiveFlow: jest.fn(() => true),
			startOAuthFlow: jest.fn(async () => {}),
		} as any;
		(handler as any).oauthManager = oauthInstance;

		await handler.handleOutput("auth");

		expect(oauthInstance.startOAuthFlow).not.toHaveBeenCalled();
	});

	test("warns when OAuth required but no authUrl", async () => {
		const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
		const handler = new MCPOutputHandler(baseConfig);
		const oauthInstance = {
			detectOAuthFromOutput: jest.fn(() => ({
				requiresAuth: true,
				authUrl: null,
				callbackPort: undefined,
				state: undefined,
			})),
			hasActiveFlow: jest.fn(() => false),
			startOAuthFlow: jest.fn(async () => {}),
		} as any;
		(handler as any).oauthManager = oauthInstance;

		await handler.handleOutput("OAuth required but missing URL");

		expect(warnSpy).toHaveBeenCalled();
	});

	test("shows permission notice with link and copies URL, de-duplicated on repeat", async () => {
		const handler = new MCPOutputHandler(baseConfig);
		const output = [
			"Error POSTing to endpoint (HTTP 403): Access denied X",
			"Link: https://example.com/request",
			"Description: Please request access",
		].join("\n");

		await handler.handleOutput(output);

		expect(NoticeMock).toHaveBeenCalled();
		const noticeInstance = (NoticeMock as any).mock.results[0].value;
		expect(String(noticeInstance.noticeEl.innerHTML)).toContain(
			'<span style="color: #0066cc; text-decoration: underline;">https://example.com/request</span>'
		);
		expect((global as any).navigator.clipboard.writeText).toHaveBeenCalledWith(
			"https://example.com/request"
		);

		(NoticeMock as any).mockClear();
		await handler.handleOutput(output);
		expect(NoticeMock).not.toHaveBeenCalled();
	});

	test("shows permission notice without link (no clipboard or url highlight)", async () => {
		const handler = new MCPOutputHandler({ ...baseConfig, name: "ClientTwo" });
		const output = "Error POSTing to endpoint (HTTP 403): Missing permission Y";

		await handler.handleOutput(output);

		expect(NoticeMock).toHaveBeenCalled();
		const noticeInstance = (NoticeMock as any).mock.results[0].value;
		const html = String(noticeInstance.noticeEl.innerHTML);
		expect(html.includes("http")).toBe(false);
		expect(
			(global as any).navigator.clipboard.writeText
		).not.toHaveBeenCalled();
	});
});
