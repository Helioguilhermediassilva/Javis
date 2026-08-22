import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { createXavierPresentationAttachment, renderXavierPresentationBuffer } from "./xavierPresentation.js";

describe("renderXavierPresentationBuffer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("normaliza uma imagem WebP para JPEG otimizado antes de incorporá-la ao PPTX", async () => {
    const webp = await sharp({
      create: {
        width: 96,
        height: 96,
        channels: 4,
        background: { r: 20, g: 184, b: 166, alpha: 1 },
      },
    }).webp().toBuffer();

    const fetchMock = vi.fn(async () => new Response(webp, {
      status: 200,
      headers: {
        "content-type": "image/webp",
        "content-length": String(webp.length),
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const pptx = await renderXavierPresentationBuffer(
      "Apresentação de teste",
      "# Apresentação de teste\n\n## Visão geral\n- Conteúdo de validação",
      ["https://example.com/runway.webp"],
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(pptx.subarray(0, 2).toString()).toBe("PK");
    expect(pptx.length).toBeGreaterThan(1_000);
  });

  it("redimensiona e comprime uma imagem de alta resolução para reduzir o PPTX", async () => {
    const largePng = await sharp({
      create: {
        width: 5_000,
        height: 3_000,
        channels: 3,
        background: { r: 15, g: 44, b: 62 },
      },
    }).png().toBuffer();

    const fetchMock = vi.fn(async () => new Response(largePng, {
      status: 200,
      headers: {
        "content-type": "image/png",
        "content-length": String(largePng.length),
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const pptx = await renderXavierPresentationBuffer(
      "Apresentação compacta",
      "# Apresentação compacta\n\n## Visão geral\n- Conteúdo de validação",
      ["https://example.com/large.png"],
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(pptx.subarray(0, 2).toString()).toBe("PK");
    expect(pptx.length).toBeLessThan(1_000_000);
  });

  it("não duplica imagens em todos os slides quando o deck recebe várias referências", async () => {
    const raw = randomBytes(1_280 * 720 * 3);
    const jpeg = await sharp(raw, { raw: { width: 1_280, height: 720, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
    const fetchMock = vi.fn(async () => new Response(jpeg, {
      status: 200,
      headers: {
        "content-type": "image/jpeg",
        "content-length": String(jpeg.length),
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const pptx = await renderXavierPresentationBuffer(
      "Apresentação visual",
      "# Apresentação visual\n\n## Contexto\n- Um\n- Dois\n\n## Plano\n- Três\n- Quatro\n\n## Execução\n- Cinco",
      [
        "https://example.com/one.jpg",
        "https://example.com/two.jpg",
        "https://example.com/three.jpg",
        "https://example.com/four.jpg",
      ],
    );

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(pptx.subarray(0, 2).toString()).toBe("PK");
    expect(pptx.length).toBeLessThan(5 * 1024 * 1024);
  });

  it("remove o objeto parcial quando o Storage rejeita o upload por tamanho", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ statusCode: "413", code: "EntityTooLarge" }), { status: 413 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createXavierPresentationAttachment({
      userId: "user-1",
      taskId: "task-1",
      title: "Apresentação",
      outline: "# Apresentação\n\n## Visão geral\n- Conteúdo",
    })).rejects.toThrow("tamanho acima do limite do bucket");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[0]).toContain("/storage/v1/object/remove");
  });
});
