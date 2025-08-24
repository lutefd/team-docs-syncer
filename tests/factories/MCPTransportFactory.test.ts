import { MCPTransportFactory } from "../../src/factories/MCPTransportFactory";
import { MCP_TRANSPORT_TYPE, MCPClientConfig } from "../../src/types/Settings";

const stdioCreateMock = jest.fn();

jest.mock("../../src/factories/StdioTransportFactory", () => ({
  StdioTransportFactory: jest.fn().mockImplementation(() => ({
    create: stdioCreateMock,
  })),
}));

jest.mock("@modelcontextprotocol/sdk/client/sse.js", () => ({
  SSEClientTransport: function (this: any, url: URL) {
    this.url = url;
  },
}));

jest.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: function (this: any, url: URL) {
    this.url = url;
  },
}));

describe("MCPTransportFactory", () => {
  beforeEach(() => {
    stdioCreateMock.mockReset();
  });

  function makeConfig(partial: Partial<MCPClientConfig>): MCPClientConfig {
    return {
      id: "id1",
      name: "c1",
      enabled: true,
      transport: {
        type: MCP_TRANSPORT_TYPE.STDIO,
        command: "node",
        args: "server.js",
        url: "",
      },
      ...partial,
    } as any;
  }

  test("STDIO uses StdioTransportFactory.create() and requires command", async () => {
    const f = new MCPTransportFactory();
    stdioCreateMock.mockResolvedValueOnce({ kind: "stdio" });

    const cfg = makeConfig({ transport: { type: MCP_TRANSPORT_TYPE.STDIO, command: "node", args: "srv.js", url: "" } });
    const t = await f.createTransport(cfg);
    expect(t).toEqual({ kind: "stdio" });
    expect(stdioCreateMock).toHaveBeenCalled();

    await expect(
      f.createTransport(makeConfig({ transport: { type: MCP_TRANSPORT_TYPE.STDIO, command: "", args: "", url: "" } }))
    ).rejects.toThrow(/requires command/i);
  });

  test("SSE returns transport and requires url", async () => {
    const f = new MCPTransportFactory();
    const cfg = makeConfig({ transport: { type: MCP_TRANSPORT_TYPE.SSE, url: "http://x/sse" } as any });
    const t: any = await f.createTransport(cfg);
    expect(String(t.url)).toBe("http://x/sse");

    await expect(
      f.createTransport(makeConfig({ transport: { type: MCP_TRANSPORT_TYPE.SSE, url: "" } as any }))
    ).rejects.toThrow(/requires URL/i);
  });

  test("HTTP returns transport and requires url", async () => {
    const f = new MCPTransportFactory();
    const cfg = makeConfig({ transport: { type: MCP_TRANSPORT_TYPE.HTTP, url: "http://x/mcp" } as any });
    const t: any = await f.createTransport(cfg);
    expect(String(t.url)).toBe("http://x/mcp");

    await expect(
      f.createTransport(makeConfig({ transport: { type: MCP_TRANSPORT_TYPE.HTTP, url: "" } as any }))
    ).rejects.toThrow(/requires URL/i);
  });
});
