import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendXavierTelegramDocumentBytes } from "./xavierTelegram.js";

function encryptToken(token: string, secret: string): string {
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const payload = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), payload].map((part) => part.toString("base64url")).join(".");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Xavier linked Telegram transient documents", () => {
  it("envia bytes por multipart sem fazer download de URL", async () => {
    vi.stubEnv("XAVIER_ENCRYPTION_KEY", "test-encryption-key");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain("/sendDocument");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeInstanceOf(FormData);
      const form = init?.body as FormData;
      expect(form.get("chat_id")).toBe("987654");
      expect(form.get("caption")).toBe("Arquivo de teste");
      const document = form.get("document");
      expect(document).toBeInstanceOf(File);
      expect((document as File).name).toBe("teste.pdf");
      expect((document as File).type).toBe("application/pdf");
      expect(await (document as File).arrayBuffer()).toEqual(Uint8Array.from([37, 80, 68, 70]).buffer);
      return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendXavierTelegramDocumentBytes(
      {
        encrypted_bot_token: encryptToken("123456:linked-test-token", "test-encryption-key"),
      } as Parameters<typeof sendXavierTelegramDocumentBytes>[0],
      "987654",
      Buffer.from("%PDF"),
      "application/pdf",
      "Arquivo de teste",
      "teste.pdf",
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith("https://files.example"))).toBe(false);
  });
});
