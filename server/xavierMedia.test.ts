import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { XavierActionRequest } from "./xavierTaskOrchestrator.js";

describe("executeXavierTransientVisualPresentationAction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("baixa a imagem do provedor, compõe o PPTX em memória e não chama o Storage", async () => {
    vi.stubEnv("RUNWAY_API_SECRET", "test-runway-secret");
    const { executeXavierTransientVisualPresentationAction } = await import("./xavierMedia.js");
    const image = await sharp({
      create: {
        width: 320,
        height: 180,
        channels: 3,
        background: { r: 20, g: 184, b: 166 },
      },
    }).png().toBuffer();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "runway-task-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "SUCCEEDED", output: ["https://runway.example/image.png"] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(image, { status: 200, headers: { "content-type": "image/png", "content-length": String(image.length) } }));
    vi.stubGlobal("fetch", fetchMock);

    const action: XavierActionRequest = {
      id: "action-visual-1",
      user_id: "user-1",
      channel: "telegram",
      conversation_id: "conversation-1",
      telegram_connection_id: "connection-1",
      telegram_chat_id: "chat-1",
      kind: "presentation",
      title: "Apresentação com imagens solicitada",
      request_text: "Crie uma apresentação com uma imagem profissional sobre inovação.",
      status: "running",
      approval_code: "XAV-TEST1234",
      metadata: { visual_presentation: true },
      result_text: null,
      attachments: [],
      error_message: null,
      created_at: "2026-08-22T00:00:00.000Z",
      updated_at: "2026-08-22T00:00:00.000Z",
      approved_at: "2026-08-22T00:00:00.000Z",
      completed_at: null,
    };

    const result = await executeXavierTransientVisualPresentationAction(action);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => String(url)).some((url) => /supabase|storage\/v1/i.test(url))).toBe(false);
    expect(result.artifacts).toHaveLength(2);
    expect(result.artifacts[0]?.mime_type).toBe("image/png");
    expect(result.artifacts[0]?.bytes.equals(image)).toBe(true);
    expect(result.artifacts[1]?.file_name).toMatch(/\.pptx$/);
    expect(result.artifacts[1]?.bytes.subarray(0, 2).toString()).toBe("PK");
    expect(result.artifacts.every((artifact) => artifact.size_bytes === artifact.bytes.length)).toBe(true);
  });
});
