import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let official: typeof import("./xavierTelegramOfficial.js");

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

beforeAll(async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  process.env.TELEGRAM_BOT_TOKEN = "123456:test-token";
  process.env.TELEGRAM_OFFICIAL_WEBHOOK_SECRET = "official-test-secret";
  process.env.XAVIER_TELEGRAM_WEBHOOK_BASE_URL = "https://example.test/api/telegram/webhook";
  official = await import("./xavierTelegramOfficial.js");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("xavierTelegramOfficial", () => {
  it("verifica o segredo oficial com comparação segura e rejeita valores diferentes", () => {
    expect(official.verifyOfficialTelegramWebhookSecret("official-test-secret")).toBe(true);
    expect(official.verifyOfficialTelegramWebhookSecret("wrong-secret")).toBe(false);
    expect(official.verifyOfficialTelegramWebhookSecret("")).toBe(false);
  });

  it("gera deep link com bot oficial, locale e expiração", async () => {
    const fetchMock: FetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("api.telegram.org")) {
        const method = url.slice(url.lastIndexOf("/") + 1);
        if (method === "getMe") return jsonResponse({ ok: true, result: { id: 42, is_bot: true, first_name: "Xavier", username: "XavierOfficialBot" } });
        return jsonResponse({ ok: true, result: true });
      }
      if (url.includes("xavier_telegram_link_codes") && init?.method === "PATCH") return emptyResponse();
      if (url.includes("xavier_telegram_link_codes") && init?.method === "POST") return jsonResponse([{ id: "code-1" }], 201);
      throw new Error(`Unexpected mocked request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await official.createOfficialTelegramLinkCode("user-1", "es");

    expect(result.bot_username).toBe("XavierOfficialBot");
    expect(result.deep_link).toMatch(/^https:\/\/t\.me\/XavierOfficialBot\?start=[A-Za-z0-9_-]{32}$/);
    expect(result.expires_at).toBeTruthy();
    expect(fetchMock).toHaveBeenCalled();
    const createCall = fetchMock.mock.calls.find(([input, init]) => String(input).includes("xavier_telegram_link_codes") && init?.method === "POST");
    expect(createCall).toBeTruthy();
    expect(JSON.parse(String(createCall?.[1]?.body)).locale).toBe("es");
  });

  it("consome o código, vincula o chat ao usuário correto e registra o locale do código", async () => {
    let capturedCodeHash = "";
    const link = {
      id: "link-1",
      user_id: "user-1",
      telegram_chat_id: "987654",
      telegram_user_id: "123",
      telegram_username: "helio",
      telegram_first_name: "Helio",
      telegram_last_name: null,
      locale: "en" as const,
      status: "active" as const,
      linked_at: "2026-08-20T00:00:00.000Z",
      last_seen_at: "2026-08-20T00:00:00.000Z",
      unlinked_at: null,
    };
    const fetchMock: FetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("xavier_telegram_link_codes") && init?.method === "POST") {
        capturedCodeHash = JSON.parse(String(init.body)).code_hash;
        return jsonResponse([{ id: "code-1" }], 201);
      }
      if (url.includes("xavier_telegram_link_codes") && init?.method === "PATCH") return emptyResponse();
      if (url.includes("xavier_telegram_link_codes") && url.includes("code_hash=eq.")) {
        return jsonResponse([{ id: "code-1", user_id: "user-1", code_hash: capturedCodeHash, locale: "en", expires_at: new Date(Date.now() + 60_000).toISOString(), consumed_at: null }]);
      }
      if (url.includes("xavier_telegram_official_links") && init?.method === "POST") return jsonResponse([link], 201);
      if (url.includes("xavier_telegram_official_links") && !init?.method) return jsonResponse([]);
      if (url.includes("api.telegram.org")) {
        const method = url.slice(url.lastIndexOf("/") + 1);
        if (method === "getMe") return jsonResponse({ ok: true, result: { id: 42, is_bot: true, username: "XavierOfficialBot" } });
        return jsonResponse({ ok: true, result: true });
      }
      throw new Error(`Unexpected mocked request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const generated = await official.createOfficialTelegramLinkCode("user-1", "en");
    const code = new URL(generated.deep_link).searchParams.get("start");
    expect(code).toBeTruthy();

    const result = await official.consumeOfficialTelegramLinkCode(code || "", { id: 987654, username: "helio" }, { id: 123, username: "helio" });

    expect(result.user_id).toBe("user-1");
    expect(result.telegram_chat_id).toBe("987654");
    expect(result.locale).toBe("en");
    const consumedCall = fetchMock.mock.calls.find(([input, init]) => String(input).includes("xavier_telegram_link_codes?id=eq.code-1") && init?.method === "PATCH");
    expect(consumedCall).toBeTruthy();
  });
});
