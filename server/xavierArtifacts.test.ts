import { describe, expect, it } from "vitest";
import { getTelegramClaudeTimeoutMs, isPdfTaskRequest, isPresentationTaskRequest, shouldUseWebSearchForRequest } from "./xavierArtifacts.js";
import { renderXavierPresentationBuffer } from "./xavierPresentation.js";

describe("xavier artifacts", () => {
  it("reconhece solicitações explícitas de PDF", () => {
    expect(isPdfTaskRequest("Gere um PDF com o resumo executivo")).toBe(true);
    expect(isPdfTaskRequest("Faz um PDF pra mim")).toBe(true);
    expect(isPdfTaskRequest("Me manda um documento em PDF")).toBe(true);
    expect(isPdfTaskRequest("Explique o que é PDF")).toBe(false);
  });

  it("reconhece apresentações, slides e PowerPoint", () => {
    expect(isPresentationTaskRequest("Crie uma apresentação para a prefeitura")).toBe(true);
    expect(isPresentationTaskRequest("Monte slides sobre o projeto Xavier")).toBe(true);
    expect(isPresentationTaskRequest("Gere um PowerPoint com os próximos passos")).toBe(true);
    expect(isPresentationTaskRequest("Me envie uma apresentação")).toBe(true);
    expect(isPresentationTaskRequest("Quero um arquivo de slides")).toBe(true);
    expect(isPresentationTaskRequest("O que é uma apresentação executiva?")).toBe(false);
  });

  it("habilita pesquisa web apenas quando o pedido depende de informação externa", () => {
    expect(shouldUseWebSearchForRequest("Pesquise tendências recentes no YouTube")).toBe(true);
    expect(shouldUseWebSearchForRequest("Gere um PDF com este texto")).toBe(false);
  });

  it("usa uma janela maior para pesquisa iniciada por áudio", () => {
    expect(getTelegramClaudeTimeoutMs({ hasAudio: true, useWebSearch: true })).toBe(65_000);
    expect(getTelegramClaudeTimeoutMs({ hasAudio: false, useWebSearch: true })).toBe(65_000);
    expect(getTelegramClaudeTimeoutMs({ hasAudio: true, useWebSearch: false })).toBe(35_000);
    expect(getTelegramClaudeTimeoutMs({ hasAudio: false, useWebSearch: false })).toBe(45_000);
  });

  it("renderiza uma apresentação PPTX editável", async () => {
    const file = await renderXavierPresentationBuffer(
      "Projeto Xavier",
      "# Projeto Xavier\n\n## Slide 1: Visão geral\n- Assistente soberano\n- Memória por usuário\n\n## Slide 2: Próximos passos\n- Validar pelo Telegram\n- Acompanhar resultados",
    );
    expect(file.length).toBeGreaterThan(2_000);
    expect(file.subarray(0, 2).toString("utf8")).toBe("PK");
  });
});
