import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { renderXavierPresentationBuffer } from "./xavierPresentation.js";

describe("renderXavierPresentationBuffer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normaliza uma imagem WebP para PNG antes de incorporá-la ao PPTX", async () => {
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
});
