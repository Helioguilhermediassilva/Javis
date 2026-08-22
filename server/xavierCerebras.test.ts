import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCerebrasMessages,
  generateCerebrasReply,
  parseCerebrasCompletion,
  requestCerebrasCompletion,
  shouldUseCerebrasFastPath,
  XavierCerebrasUpstreamError,
} from "./xavierCerebras";

const originalFetch = globalThis.fetch;

function restoreEnvironment(): void {
  globalThis.fetch = originalFetch;
  for (const key of [
    "CEREBRAS_API_KEY",
    "CEREBRAS_BASE_URL",
    "CEREBRAS_MODEL",
    "CEREBRAS_FAST_PATH_ENABLED",
    "CEREBRAS_MAX_COMPLETION_TOKENS",
    "CEREBRAS_TIMEOUT_MS",
  ]) delete process.env[key];
  vi.restoreAllMocks();
}

afterEach(restoreEnvironment);

describe("Xavier Cerebras client", () => {
  it("builds a bounded OpenAI-compatible message list", () => {
    const messages = buildCerebrasMessages({
      systemPrompt: "Sistema",
      history: [
        { role: "system", content: "não deve duplicar o sistema" },
        { role: "user", content: "Olá" },
        { role: "assistant", content: "Como posso ajudar?" },
      ],
      userMessage: "Qual é o próximo passo?",
    });

    expect(messages).toEqual([
      { role: "system", content: "Sistema" },
      { role: "user", content: "Olá" },
      { role: "assistant", content: "Como posso ajudar?" },
      { role: "user", content: "Qual é o próximo passo?" },
    ]);
  });

  it.each([
    ["Olá, tudo bem?", true],
    ["Crie um PDF com o relatório", false],
    ["Pesquise notícias recentes", false],
    ["/claude explique isso", false],
  ])("classifica %s como fast path=%s", (userMessage, expected) => {
    vi.stubEnv("CEREBRAS_API_KEY", "csk-test");
    expect(shouldUseCerebrasFastPath({ engine: "auto", userMessage })).toBe(expected);
  });

  it("não habilita o fast path quando o kill switch está desligado", () => {
    vi.stubEnv("CEREBRAS_API_KEY", "csk-test");
    vi.stubEnv("CEREBRAS_FAST_PATH_ENABLED", "false");
    expect(shouldUseCerebrasFastPath({ engine: "auto", userMessage: "Olá" })).toBe(false);
  });

  it("envia uma completion curta com payload compatível e retorna uso sanitizado", async () => {
    vi.stubEnv("CEREBRAS_API_KEY", "csk-test");
    vi.stubEnv("CEREBRAS_MODEL", "gpt-oss-120b");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: "gpt-oss-120b",
      choices: [{ message: { content: "Resposta rápida, senhor." } }],
      usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestCerebrasCompletion([
      { role: "system", content: "Responda em português." },
      { role: "user", content: "Olá" },
    ], { maxCompletionTokens: 128, timeoutMs: 5_000 });

    expect(result).toMatchObject({
      provider: "cerebras",
      model: "gpt-oss-120b",
      content: "Resposta rápida, senhor.",
      usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.cerebras.ai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer csk-test");
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "gpt-oss-120b",
      max_completion_tokens: 128,
      stream: false,
    });
  });

  it("propaga erro upstream sem vazar o token", async () => {
    vi.stubEnv("CEREBRAS_API_KEY", "csk-secret-value");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429 })));

    await expect(requestCerebrasCompletion([{ role: "user", content: "Olá" }])).rejects.toMatchObject<XavierCerebrasUpstreamError>({
      status: 429,
    });
    await expect(requestCerebrasCompletion([{ role: "user", content: "Olá" }])).rejects.not.toThrow("csk-secret-value");
  });

  it("gera uma resposta pelo wrapper sem enviar bytes ou tools", async () => {
    vi.stubEnv("CEREBRAS_API_KEY", "csk-test");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "Tudo certo." } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateCerebrasReply({
      systemPrompt: "Seja conciso.",
      history: [{ role: "assistant", content: "Olá." }],
      userMessage: "Como está?",
      maxCompletionTokens: 64,
    });

    expect(result.content).toBe("Tudo certo.");
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).not.toHaveProperty("tools");
  });

  it("rejeita resposta sem conteúdo textual", () => {
    expect(() => parseCerebrasCompletion(JSON.stringify({ choices: [{ message: {} }] }))).toThrow("não retornou uma resposta textual");
  });
});
