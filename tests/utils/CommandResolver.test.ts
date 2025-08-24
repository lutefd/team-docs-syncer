const execMock = jest.fn();
jest.mock("child_process", () => ({ exec: execMock }));

const fsMock: any = {
	existsSync: jest.fn(() => false),
	statSync: jest.fn(() => ({ mode: parseInt("755", 8) })),
	readdirSync: jest.fn(() => []),
};
jest.mock("fs", () => fsMock);

describe("CommandResolver", () => {
	let CommandResolver: any;
	let resolver: any;
	let HOME_OLD: string | undefined;

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();

		HOME_OLD = process.env.HOME;
		process.env.HOME = "/home/test";

		execMock.mockImplementation((_cmd: string, _opts: any, cb: any) => {
			cb(new Error("not found"));
		});

		fsMock.existsSync.mockReturnValue(false);
		fsMock.statSync.mockReturnValue({ mode: parseInt("755", 8) });
		fsMock.readdirSync.mockReturnValue([]);

		({ CommandResolver } = require("../../src/utils/CommandResolver"));
		resolver = new CommandResolver();
	});

	afterEach(() => {
		if (HOME_OLD === undefined) delete (process.env as any).HOME;
		else process.env.HOME = HOME_OLD;
	});

	test("returns input when path is absolute", async () => {
		await expect(resolver.resolveCommandPath("/usr/bin/node")).resolves.toBe(
			"/usr/bin/node"
		);
	});

	test("resolves npx based on node path and existence", async () => {
		execMock.mockImplementationOnce((cmd: string, _opts: any, cb: any) => {
			if (cmd.startsWith("which node"))
				cb(null, { stdout: "/usr/local/bin/node\n", stderr: "" });
			else cb(new Error("unknown"));
		});
		fsMock.existsSync.mockImplementation(
			(p: string) => p === "/usr/local/bin/npx"
		);

		const out = await resolver.resolveCommandPath("npx");
		expect(out).toBe("/usr/local/bin/npx");
	});

	test("resolves node via fnm directories", async () => {
		fsMock.existsSync.mockImplementation(
			(p: string) =>
				p === "/home/test/.local/state/fnm_multishells" ||
				p.endsWith("/bin/node")
		);
		fsMock.readdirSync.mockImplementation((p: string) =>
			p.includes("fnm_multishells") ? ["X1"] : []
		);
		fsMock.statSync.mockReturnValue({ mode: parseInt("755", 8) });

		const out = await resolver.resolveCommandPath("node");
		expect(out).toBe("/home/test/.local/state/fnm_multishells/X1/bin/node");
	});

	test("resolves node via nvm path when fnm not found", async () => {
		fsMock.existsSync.mockImplementation(
			(p: string) => p === "/home/test/.nvm/current/bin/node"
		);
		fsMock.statSync.mockReturnValue({ mode: parseInt("755", 8) });

		const out = await resolver.resolveCommandPath("node");
		expect(out).toBe("/home/test/.nvm/current/bin/node");
	});

	test("falls back to which when not found in custom locations", async () => {
		execMock.mockImplementationOnce((cmd: string, _opts: any, cb: any) => {
			if (cmd.startsWith("which git"))
				cb(null, { stdout: "/usr/bin/git\n", stderr: "" });
			else cb(new Error("unknown"));
		});
		const out = await resolver.resolveCommandPath("git");
		expect(out).toBe("/usr/bin/git");
	});

	test("uses commonPaths for python3 when available and executable", async () => {
		fsMock.existsSync.mockImplementation(
			(p: string) => p === "/usr/local/bin/python3"
		);
		fsMock.statSync.mockReturnValue({ mode: parseInt("755", 8) });

		const out = await resolver.resolveCommandPath("python3");
		expect(out).toBe("/usr/local/bin/python3");
	});

	test("returns command as-is when nothing resolves", async () => {
		execMock.mockImplementationOnce((cmd: string, _opts: any, cb: any) => {
			if (cmd.startsWith("which foo"))
				cb(null, { stdout: "foo\n", stderr: "" });
			else cb(new Error("unknown"));
		});
		fsMock.existsSync.mockReturnValue(false);

		const out = await resolver.resolveCommandPath("foo");
		expect(out).toBe("foo");
	});
});
