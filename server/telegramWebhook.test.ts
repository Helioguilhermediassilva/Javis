import { afterEach, describe, expect, it } from "vitest";
import handler from "../api/telegram/webhook";

function makeResponse() {
  const state: { status?: number; body?: unknown } = {};
  const response = {
    status(code: number) {
      state.status = code;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
    setHeader() {
      return response;
    },
    state,
  };
  return response;
}

afterEach(() => {
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
});

describe("Telegram webhook", () => {
  it("recusa requests sem o segredo do Telegram", async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "secret-for-test";
    const response = makeResponse();
    await handler({ method: "POST", headers: {}, body: {} } as never, response as never);
    expect(response.state.status).toBe(401);
    expect(response.state.body).toEqual({ error: "Unauthorized" });
  });

  it("acknowledges updates sem mensagem de texto sem chamar o backend de IA", async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "secret-for-test";
    const response = makeResponse();
    await handler(
      {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "secret-for-test" },
        body: { update_id: 101, edited_message: { text: "não processar" } },
      } as never,
      response as never,
    );
    expect(response.state.status).toBe(200);
    expect(response.state.body).toEqual({ ok: true, ignored: true });
  });
});
