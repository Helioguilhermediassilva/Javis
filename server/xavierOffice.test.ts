import { afterEach, describe, expect, it, vi } from "vitest";
import { createXavierOfficeAttachment } from "./xavierOffice";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.XAVIER_CLAUDE_CODE_EXECUTION;
});

function stubServices(): { uploads: Array<{ url: string; body: unknown }> } {
  const uploads: Array<{ url: string; body: unknown }> = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/v1/messages")) {
      return new Response(JSON.stringify({
        type: "message",
        stop_reason: "end_turn",
        content: [{ type: "text", text: "# Conteúdo gerado\n\n## Detalhes\nLinha de teste;Valor" }],
      }), { status: 200 });
    }
    if (url.endsWith("/storage/v1/bucket")) return new Response("", { status: 409 });
    if (url.includes("/storage/v1/object/sign/")) return new Response(JSON.stringify({ signedURL: "https://files.example.test/signed" }), { status: 200 });
    if (url.includes("/storage/v1/object/")) {
      uploads.push({ url, body: init?.body });
      return new Response("", { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { uploads };
}

describe("Xavier office artifacts", () => {
  it.each([
    ["document", "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["spreadsheet", "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["image", "svg", "image/svg+xml"],
  ] as const)("gera arquivo binário real para %s", async (kind, extension, contentType) => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    const { uploads } = stubServices();

    const result = await createXavierOfficeAttachment({
      userId: "user-123",
      taskId: `task-${kind}`,
      title: "Artefato de teste",
      kind,
      requestText: `Crie um ${kind}`,
      history: [],
      timeoutMs: 5_000,
    });

    expect(result.file_name.endsWith(`.${extension}`)).toBe(true);
    expect(result.url).toBe("https://files.example.test/signed");
    expect(result.size_bytes).toBeGreaterThan(0);
    expect(uploads).toHaveLength(1);
    expect(uploads[0].url).toContain(`/xavier-files/xavier/user-123/task-${kind}.${extension}`);
    expect(uploads[0].body).toBeInstanceOf(Buffer);
    expect((uploads[0].body as Buffer).length).toBeGreaterThan(20);
    expect((uploads[0].body as Buffer).subarray(0, 2).toString()).toBe(kind === "image" ? "<s" : "PK");
    const headers = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find((call) => String(call[0]).includes("/storage/v1/object/xavier-files/"))?.[1]?.headers as Headers;
    expect(headers.get("Content-Type")).toBe(contentType);
  });
});

void originalFetch;
