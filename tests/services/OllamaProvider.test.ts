describe("OllamaProvider", () => {
	const mockCreate = jest.fn((opts: any) => ({
		providerTag: "ollama-provider",
		opts,
	}));

	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		jest.doMock("@ai-sdk/openai-compatible", () => ({
			createOpenAICompatible: (opts: any) => mockCreate(opts),
		}));
	});

	test("default export 'ollama' uses default baseURL and name", () => {
		const mod = require("../../src/services/OllamaProvider");
		expect(mockCreate).toHaveBeenCalledTimes(1);
		expect(mockCreate).toHaveBeenCalledWith({
			name: "ollama",
			baseURL: "http://localhost:11434/v1",
			headers: undefined,
		});
		expect(mod.ollama).toEqual({
			providerTag: "ollama-provider",
			opts: {
				name: "ollama",
				baseURL: "http://localhost:11434/v1",
				headers: undefined,
			},
		});
	});

	test("createOllama passes through custom baseURL and headers", () => {
		const { createOllama } = require("../../src/services/OllamaProvider");

		const custom = createOllama({
			baseURL: "http://myhost:1234/v1",
			headers: { A: "1", B: "2" },
		});
		expect(mockCreate).toHaveBeenCalledTimes(2);
		const lastCall = mockCreate.mock.calls[1][0];
		expect(lastCall).toEqual({
			name: "ollama",
			baseURL: "http://myhost:1234/v1",
			headers: { A: "1", B: "2" },
		});

		expect(custom).toEqual({ providerTag: "ollama-provider", opts: lastCall });
	});

	test("createOllama without options uses default baseURL and no headers", () => {
		const { createOllama } = require("../../src/services/OllamaProvider");

		const inst = createOllama();
		const last = mockCreate.mock.calls.pop()?.[0];
		expect(last).toEqual({
			name: "ollama",
			baseURL: "http://localhost:11434/v1",
			headers: undefined,
		});
		expect(inst).toEqual({ providerTag: "ollama-provider", opts: last });
	});
});
