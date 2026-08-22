import { afterEach, describe, expect, it, vi } from "vitest";
import { createXavierTransientPdfArtifact } from "./xavierPdf.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Xavier transient PDF artifact", () => {
  it("retorna bytes PDF sem chamar o Storage", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await createXavierTransientPdfArtifact({
      title: "Relatório transitório",
      body: "# Resumo\n\nConteúdo mantido somente em memória durante a entrega.",
    });

    expect(result.file_name).toBe("Relatorio-transitorio.pdf");
    expect(result.mime_type).toBe("application/pdf");
    expect(result.size_bytes).toBe(result.bytes.length);
    expect(result.bytes.subarray(0, 4).toString()).toBe("%PDF");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

void describe;
