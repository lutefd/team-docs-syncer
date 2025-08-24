import { AiProviderFactory } from "../../src/factories/AiProviderFactory";
import { AiProvider } from "../../src/types/AiProvider";
import { DEFAULT_SETTINGS, TeamDocsSettings } from "../../src/types/Settings";
import { DEFAULT_MODELS } from "../../src/types/ModelsDescription";

jest.mock("@ai-sdk/openai", () => ({
  createOpenAI: jest.fn(() => (modelId: string) => `openai:${modelId}`),
}));

jest.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: jest.fn(() => (modelId: string) => `anthropic:${modelId}`),
}));

jest.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: jest.fn(() => (modelId: string) => `google:${modelId}`),
}));

jest.mock("../../src/services/OllamaProvider", () => ({
  createOllama: jest.fn((opts: any) => (modelId: string) => `ollama:${opts?.baseURL || ''}:${modelId}`),
}));

describe("AiProviderFactory", () => {
  function makeSettings(partial: Partial<TeamDocsSettings>): TeamDocsSettings {
    return {
      ...DEFAULT_SETTINGS,
      ai: {
        ...DEFAULT_SETTINGS.ai,
        openaiApiKey: "",
        anthropicApiKey: "",
        googleApiKey: "",
        ollamaBaseUrl: "http://localhost:11434",
        ollamaComposeModels: [],
        ollamaChatModels: [],
      },
      ...partial,
    } as TeamDocsSettings;
  }

  test("getAvailableModels returns defaults for configured providers", () => {
    const settings = makeSettings({
      ai: {
        ...DEFAULT_SETTINGS.ai,
        openaiApiKey: "sk-openai",
        anthropicApiKey: "sk-anth",
        googleApiKey: "sk-google",
        ollamaBaseUrl: "http://localhost:11434",
        ollamaComposeModels: ["llama3.2:3b"],
        ollamaChatModels: ["gemma2:2b"],
      },
    });
    const f = new AiProviderFactory(settings);

    expect(f.getAvailableModels(AiProvider.OPENAI).length).toBe(
      DEFAULT_MODELS[AiProvider.OPENAI].length
    );
    expect(f.getAvailableModels(AiProvider.ANTHROPIC).length).toBe(
      DEFAULT_MODELS[AiProvider.ANTHROPIC].length
    );
    const ollamaAll = f.getAvailableModels(AiProvider.OLLAMA);
    expect(ollamaAll.map((m) => m.id)).toEqual(["llama3.2:3b", "gemma2:2b"]);
    const composeOnly = f.getAvailableModels(AiProvider.OLLAMA, "compose");
    expect(composeOnly.map((m) => m.id)).toEqual(["llama3.2:3b"]);
    const chatOnly = f.getAvailableModels(AiProvider.OLLAMA, "chat");
    expect(chatOnly.map((m) => m.id)).toEqual(["gemma2:2b"]);
    expect(f.getAvailableModels(AiProvider.GOOGLE).length).toBe(
      DEFAULT_MODELS[AiProvider.GOOGLE].length
    );
  });

  test("getAvailableProviders only returns configured ones", () => {
    const settings = makeSettings({
      ai: {
        ...DEFAULT_SETTINGS.ai,
        openaiApiKey: "sk-openai",
        anthropicApiKey: "",
        googleApiKey: "",
        ollamaBaseUrl: "http://localhost:11434",
        ollamaComposeModels: ["a"],
        ollamaChatModels: [],
      },
    });
    const f = new AiProviderFactory(settings);
    const providers = f.getAvailableProviders();
    const names = providers.map((p) => p.provider);
    expect(names).toContain(AiProvider.OPENAI);
    expect(names).toContain(AiProvider.OLLAMA);
    expect(names).not.toContain(AiProvider.ANTHROPIC);
    expect(names).not.toContain(AiProvider.GOOGLE);
  });

  test("createModel returns correct provider wrappers", () => {
    const settings = makeSettings({
      ai: {
        ...DEFAULT_SETTINGS.ai,
        openaiApiKey: "sk",
        anthropicApiKey: "sk",
        googleApiKey: "sk",
        ollamaBaseUrl: "http://localhost:11434",
      },
    });
    const f = new AiProviderFactory(settings);

    expect(f.createModel(AiProvider.OPENAI, "gpt-x")).toBe("openai:gpt-x");
    expect(f.createModel(AiProvider.ANTHROPIC, "claude")).toBe(
      "anthropic:claude"
    );
    expect(f.createModel(AiProvider.GOOGLE, "gemini")).toBe("google:gemini");
    expect(f.createModel(AiProvider.OLLAMA, "m")).toContain(
      "ollama:http://localhost:11434"
    );
  });

  test("isProviderAvailable reflects settings", () => {
    const settings = makeSettings({
      ai: {
        ...DEFAULT_SETTINGS.ai,
        openaiApiKey: "sk",
        anthropicApiKey: "",
        googleApiKey: "",
        ollamaBaseUrl: "",
        ollamaComposeModels: [],
        ollamaChatModels: [],
      },
    });
    const f = new AiProviderFactory(settings);
    expect(f.isProviderAvailable(AiProvider.OPENAI)).toBe(true);
    expect(f.isProviderAvailable(AiProvider.ANTHROPIC)).toBe(false);
    expect(f.isProviderAvailable(AiProvider.GOOGLE)).toBe(false);
    expect(f.isProviderAvailable(AiProvider.OLLAMA)).toBe(false);
  });

  test("getDefaultProviderAndModel returns first available", () => {
    const settings = makeSettings({
      ai: {
        ...DEFAULT_SETTINGS.ai,
        openaiApiKey: "sk",
        anthropicApiKey: "",
        googleApiKey: "",
        ollamaBaseUrl: "",
        ollamaComposeModels: [],
        ollamaChatModels: [],
      },
    });
    const f = new AiProviderFactory(settings);
    const def = f.getDefaultProviderAndModel();
    expect(def).not.toBeNull();
    expect(def!.provider).toBe(AiProvider.OPENAI);
    expect(def!.modelId).toBe(DEFAULT_MODELS[AiProvider.OPENAI][0].id);
  });

  test("testProvider uses /models for ollama and createModel for others", async () => {
    const settings = makeSettings({
      ai: {
        ...DEFAULT_SETTINGS.ai,
        openaiApiKey: "sk",
        anthropicApiKey: "sk",
        googleApiKey: "sk",
        ollamaBaseUrl: "http://localhost:11434",
        ollamaComposeModels: ["m1"],
        ollamaChatModels: [],
      },
    });
    const f = new AiProviderFactory(settings);

    const g: any = global;
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    g.fetch = fetchMock;

    expect(await f.testProvider(AiProvider.OLLAMA, "m1")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/models"
    );

    expect(await f.testProvider(AiProvider.OPENAI, "gpt-4")).toBe(true);

    fetchMock.mockRejectedValueOnce(new Error("network"));
    expect(await f.testProvider(AiProvider.OLLAMA, "m1")).toBe(false);
  });
});
