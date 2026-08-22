import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildXavierLlmBody,
  getXavierLlmRoute,
  isOpenRouterConfigured,
  llmCompletionsUrl,
  parseXavierLlmCompletion,
  requestXavierLlmCompletion,
  XavierLlmUpstreamError,
} from "./xavierOpenRouter";

const ENV_KEYS = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_API_URL",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_MODEL",
  "OPENROUTER_FALLBACK_MODELS",
  "OPENROUTER_SITE_URL",
  "OPENROUTER_APP_NAME",
  "OPENROUTER_DATA_COLLECTION",
  "LLM_API_URL",
  "LLM_API_KEY",
  "XAI_API_URL",
  "XAI_API_KEY",
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnv();
  vi.restoreAllMocks();
});

describe("xavierOpenRouter", () => {
  it("prioriza OpenRouter e preserva a lista de modelos fallback", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.OPENROUTER_MODEL = "google/gemini-2.5-flash-lite";
    process.env.OPENROUTER_FALLBACK_MODELS = "openai/gpt-5.6-luna,moonshotai/kimi-k2.5";
    process.env.OPENROUTER_DATA_COLLECTION = "deny";

    expect(isOpenRouterConfigured()).toBe(true);
    const route = getXavierLlmRoute();
    expect(route).toMatchObject({
      provider: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "google/gemini-2.5-flash-lite",
      fallbackModels: ["openai/gpt-5.6-luna", "moonshotai/kimi-k2.5"],
      dataCollection: "deny",
    });
    expect(route?.headers.Authorization).toBe("Bearer sk-or-test");
    expect(route?.headers["HTTP-Referer"]).toBe("https://jarvisnowgo.com");
  });

  it("usa o gateway legado somente quando OpenRouter não está configurado", () => {
    process.env.LLM_API_URL = "https://legacy.example/v1";
    process.env.LLM_API_KEY = "legacy-test";

    const route = getXavierLlmRoute();
    expect(route).toMatchObject({
      provider: "legacy",
      baseUrl: "https://legacy.example/v1",
      apiKey: "legacy-test",
      model: "grok-4.3",
      fallbackModels: [],
    });
  });

  it("monta body OpenAI-compatible com fallback e privacidade conservadora", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    const route = getXavierLlmRoute();
    if (!route) throw new Error("route expected");

    const body = buildXavierLlmBody(route, [{ role: "user", content: "Olá" }], [{ type: "function", function: { name: "buscar_dados_df" } }]);
    expect(body).toMatchObject({
      model: "google/gemini-2.5-flash-lite",
      models: ["google/gemini-2.5-flash-lite", "openai/gpt-5.6-luna", "moonshotai/kimi-k2.5"],
      tool_choice: "auto",
      stream: false,
      provider: { allow_fallbacks: true, require_parameters: true, data_collection: "deny" },
    });
  });

  it("faz uma única chamada não-streaming e extrai conteúdo, tools e modelo efetivo", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    const route = getXavierLlmRoute();
    if (!route) throw new Error("route expected");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: "moonshotai/kimi-k2.5",
      choices: [{ message: { content: "Resposta do Xavier.", tool_calls: [{ id: "call_1", type: "function", function: { name: "buscar_dados_df", arguments: JSON.stringify({ query: "saúde" }) } }] } }],
      usage: { prompt_tokens: 10, completion_tokens: 7, total_tokens: 17 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestXavierLlmCompletion(route, [{ role: "user", content: "Olá" }], []);
    expect(result).toMatchObject({
      provider: "openrouter",
      model: "moonshotai/kimi-k2.5",
      content: "Resposta do Xavier.",
      usage: { prompt_tokens: 10, completion_tokens: 7, total_tokens: 17 },
    });
    expect(result.toolCalls[0]).toMatchObject({ id: "call_1", function: { name: "buscar_dados_df" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("preserva o status HTTP de saldo insuficiente para o mapeamento acionável do Xavier", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    const route = getXavierLlmRoute();
    if (!route) throw new Error("route expected");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Insufficient credits" } }), { status: 402 })));

    await expect(requestXavierLlmCompletion(route, [], [])).rejects.toMatchObject<XavierLlmUpstreamError>({
      provider: "openrouter",
      status: 402,
    });
  });

  it("mantém o endpoint derivado sem barras duplicadas", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.OPENROUTER_API_URL = "https://openrouter.ai/api/v1///";
    const route = getXavierLlmRoute();
    if (!route) throw new Error("route expected");
    expect(llmCompletionsUrl(route)).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("ignora fallback duplicado do modelo principal", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.OPENROUTER_MODEL = "google/gemini-2.5-flash-lite";
    process.env.OPENROUTER_FALLBACK_MODELS = "google/gemini-2.5-flash-lite,moonshotai/kimi-k2.5";
    const route = getXavierLlmRoute();
    expect(route?.fallbackModels).toEqual(["moonshotai/kimi-k2.5"]);
  });

  it("faz parsing seguro de resposta sem tool calls", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    const route = getXavierLlmRoute();
    if (!route) throw new Error("route expected");
    const result = parseXavierLlmCompletion(route, JSON.stringify({ choices: [{ message: { content: "Tudo certo." } }] }));
    expect(result.content).toBe("Tudo certo.");
    expect(result.toolCalls).toEqual([]);
  });
});
