import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Readable } from "node:stream";
import { handleJarvisChatStream } from "./jarvisProxy";

/**
 * Testes do handler SSE /api/jarvis/chat/stream.
 *
 * Mockamos `fetch` global para devolver um corpo SSE controlado, simulando
 * tanto resposta direta (sem tools) quanto resposta com tool_calls + 2ª rodada.
 * Não chamamos rede real.
 */

interface MockReq {
  method: string;
  url?: string;
  on: (event: string, cb: (chunk?: Buffer) => void) => void;
}
interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  chunks: string[];
  ended: boolean;
  writeHead: (status: number, headers: Record<string, string>) => void;
  setHeader: (k: string, v: string) => void;
  write: (chunk: string | Buffer) => boolean;
  end: (chunk?: string | Buffer) => void;
  headersSent: boolean;
}

function makeReq(body: unknown): MockReq {
  const data = JSON.stringify(body);
  return {
    method: "POST",
    url: "/api/jarvis/chat/stream",
    on(event: string, cb: (chunk?: Buffer) => void) {
      if (event === "data") cb(Buffer.from(data));
      else if (event === "end") cb();
    },
  };
}

function makeRes(): MockRes {
  return {
    statusCode: 0,
    headers: {},
    chunks: [],
    ended: false,
    headersSent: false,
    writeHead(status: number, headers: Record<string, string>) {
      this.statusCode = status;
      this.headers = { ...this.headers, ...headers };
      this.headersSent = true;
    },
    setHeader(k: string, v: string) { this.headers[k] = v; },
    write(chunk: string | Buffer) {
      this.chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
      return true;
    },
    end(chunk?: string | Buffer) {
      if (chunk) this.chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
      this.ended = true;
    },
  };
}

/** Constrói uma Response Web-API com body SSE a partir de uma sequência de frames. */
function sseResponse(frames: string[]): Response {
  const stream = Readable.from(frames.map((f) => Buffer.from(f, "utf8")));
  // O fetch do Node devolve uma WHATWG Response cujo body é um ReadableStream<Uint8Array>.
  // Usamos a Web Streams API.
  const webStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const chunk of stream) {
        controller.enqueue(chunk as Uint8Array);
      }
      controller.close();
    },
  });
  return new Response(webStream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function parseSseEvents(text: string): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for (const block of text.split("\n\n")) {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data) continue;
      try {
        events.push(JSON.parse(data));
      } catch {
        // ignore non-JSON heartbeats
      }
    }
  }
  return events;
}

describe("handleJarvisChatStream (SSE)", () => {
  const origFetch = globalThis.fetch;
  const origLlmBase = process.env.LLM_API_URL;
  const origLlmKey = process.env.LLM_API_KEY;
  const origCerebrasKey = process.env.CEREBRAS_API_KEY;
  const origCerebrasEnabled = process.env.CEREBRAS_FAST_PATH_ENABLED;

  beforeEach(() => {
    process.env.LLM_API_URL = "https://example-llm.local";
    process.env.LLM_API_KEY = "test-key";
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.env.LLM_API_URL = origLlmBase;
    process.env.LLM_API_KEY = origLlmKey;
    if (origCerebrasKey === undefined) delete process.env.CEREBRAS_API_KEY;
    else process.env.CEREBRAS_API_KEY = origCerebrasKey;
    if (origCerebrasEnabled === undefined) delete process.env.CEREBRAS_FAST_PATH_ENABLED;
    else process.env.CEREBRAS_FAST_PATH_ENABLED = origCerebrasEnabled;
    vi.restoreAllMocks();
  });

  it("emite delta + done quando o LLM responde sem chamar tools", async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse([
        `data: ${JSON.stringify({ choices: [{ delta: { content: "Sim, " } }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: "senhor." } }] })}\n\n`,
        `data: [DONE]\n\n`,
      ]),
    ) as unknown as typeof fetch;

    const req = makeReq({ userMessage: "Tudo bem?" });
    const res = makeRes();
    await handleJarvisChatStream(
      req as unknown as Parameters<typeof handleJarvisChatStream>[0],
      res as unknown as Parameters<typeof handleJarvisChatStream>[1],
    );
    const events = parseSseEvents(res.chunks.join(""));
    const types = events.map((e) => e.type);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toMatch(/text\/event-stream/);
    expect(types).toEqual(["delta", "delta", "done"]);
    expect(events[0]).toMatchObject({ type: "delta", text: "Sim, " });
    expect(events[1]).toMatchObject({ type: "delta", text: "senhor." });
    expect(events[2]).toMatchObject({ type: "done", reply: "Sim, senhor." });
    // Sem tools chamadas
    const done = events[2] as { tools_used?: string[] };
    expect(done.tools_used).toEqual([]);
  });

  it("usa Cerebras para mensagem simples e mantém o contrato SSE sem chamar o gateway legado", async () => {
    process.env.CEREBRAS_API_KEY = "csk-test";
    process.env.CEREBRAS_FAST_PATH_ENABLED = "true";
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toBe("https://api.cerebras.ai/v1/chat/completions");
      return new Response(JSON.stringify({
        model: "gpt-oss-120b",
        choices: [{ message: { content: "Estou bem, senhor." } }],
        usage: { prompt_tokens: 8, completion_tokens: 5, total_tokens: 13 },
      }), { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const req = makeReq({ userMessage: "Tudo bem?" });
    const res = makeRes();
    await handleJarvisChatStream(
      req as unknown as Parameters<typeof handleJarvisChatStream>[0],
      res as unknown as Parameters<typeof handleJarvisChatStream>[1],
    );

    const events = parseSseEvents(res.chunks.join(""));
    expect(res.statusCode).toBe(200);
    expect(events).toEqual([
      { type: "delta", text: "Estou bem, senhor." },
      { type: "done", reply: "Estou bem, senhor.", tools_used: [], model: "gpt-oss-120b", executor: "cerebras", attachments: [] },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("acumula tool_calls fragmentados, executa a tool e emite tool_start/tool_end", async () => {
    let round = 0;
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("https://example-llm.local")) {
        round += 1;
        if (round === 1) {
          // 1ª rodada: o LLM pede a tool em deltas fragmentados.
          return sseResponse([
            `data: ${JSON.stringify({
              choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "buscar_dados_df" } }] } }],
            })}\n\n`,
            `data: ${JSON.stringify({
              choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"query":' } }] } }],
            })}\n\n`,
            `data: ${JSON.stringify({
              choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"saude"}' } }] } }],
            })}\n\n`,
            `data: [DONE]\n\n`,
          ]);
        }
        // 2ª rodada: resposta final em texto.
        return sseResponse([
          `data: ${JSON.stringify({ choices: [{ delta: { content: "Encontrei datasets de saúde, senhor." } }] })}\n\n`,
          `data: [DONE]\n\n`,
        ]);
      }
      if (url.startsWith("https://dados.df.gov.br")) {
        return new Response(JSON.stringify({ success: true, result: { count: 1, results: [{ id: "x", title: "Leitos", organization: { title: "SES-DF" } }] } }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    // Importante: o userMessage é propositalmente neutro para não disparar o
    // prefetch paralelo (que pegaria a intenção "briefing de saúde"). Assim este
    // teste cobre exclusivamente o caminho do tool calling fragmentado vindo do LLM.
    const req = makeReq({ userMessage: "Quantos hospitais existem?" });
    const res = makeRes();
    await handleJarvisChatStream(
      req as unknown as Parameters<typeof handleJarvisChatStream>[0],
      res as unknown as Parameters<typeof handleJarvisChatStream>[1],
    );

    const events = parseSseEvents(res.chunks.join(""));
    const types = events.map((e) => e.type);
    expect(types).toContain("tool_start");
    expect(types).toContain("tool_end");
    expect(types).toContain("delta");
    expect(types[types.length - 1]).toBe("done");
    const toolStart = events.find((e) => e.type === "tool_start") as { names: string[] };
    expect(toolStart.names).toEqual(["buscar_dados_df"]);
    const done = events[events.length - 1] as { reply: string; tools_used: string[] };
    expect(done.reply).toContain("datasets de saúde");
    expect(done.tools_used).toEqual(["buscar_dados_df"]);
    expect(round).toBe(2); // confirmou que ocorreram 2 rodadas no LLM
  });

  it("executa prefetch paralelo quando o pedido casa um briefing combinado", async () => {
    let llmCalls = 0;
    let ckanCalls = 0;
    let xaiCalls = 0;
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("https://example-llm.local")) {
        llmCalls += 1;
        // Resposta direta do LLM, sem tool_calls — o prefetch já forneceu o contexto.
        return sseResponse([
          `data: ${JSON.stringify({ choices: [{ delta: { content: "Briefing pronto, senhor." } }] })}\n\n`,
          `data: [DONE]\n\n`,
        ]);
      }
      if (url.startsWith("https://dados.df.gov.br")) {
        ckanCalls += 1;
        return new Response(
          JSON.stringify({ success: true, result: { count: 1, results: [{ id: "a", title: "Indicadores SES-DF", organization: { title: "SES-DF" } }] } }),
          { status: 200 },
        );
      }
      if (url.startsWith("https://api.x.ai")) {
        xaiCalls += 1;
        return new Response(
          JSON.stringify({
            output: [{
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify({ complaints: [{ summary: "Demora", approx_mentions: 12 }], praises: [], hashtags: ["#SaudeDF"], summary: "queixas predominantes" }) }],
            }],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    // Garante a chave do Grok no ambiente do teste para o prefetch funcionar.
    const origXaiKey = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = "test-xai-key";

    const req = makeReq({ userMessage: "me dá um briefing de saúde no DF" });
    const res = makeRes();
    try {
      await handleJarvisChatStream(
        req as unknown as Parameters<typeof handleJarvisChatStream>[0],
        res as unknown as Parameters<typeof handleJarvisChatStream>[1],
      );
    } finally {
      process.env.XAI_API_KEY = origXaiKey;
    }

    const events = parseSseEvents(res.chunks.join(""));
    const types = events.map((e) => e.type);
    // O prefetch dispara tool_start/tool_end ANTES de qualquer delta do LLM.
    expect(types[0]).toBe("tool_start");
    const firstToolStart = events[0] as { names: string[] };
    expect(firstToolStart.names).toEqual(["buscar_dados_df", "sentimento_social_df"]);
    expect(types).toContain("tool_end");
    expect(types).toContain("delta");
    expect(types[types.length - 1]).toBe("done");
    const done = events[events.length - 1] as { reply: string };
    expect(done.reply).toContain("Briefing pronto");
    // Apenas 1 chamada ao LLM (única rodada, sem tool calling adicional).
    expect(llmCalls).toBe(1);
    expect(ckanCalls).toBe(1);
    expect(xaiCalls).toBe(1);
  });
});
