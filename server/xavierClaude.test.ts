import { afterEach, describe, expect, it } from "vitest";
import {
  appendClaudeCitations,
  isClaudeConfigured,
  shouldUseClaudeTask,
} from "./xavierClaude";

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_MODEL;
});

describe("Xavier Claude router", () => {
  it("encaminha comandos explícitos para Claude", () => {
    expect(shouldUseClaudeTask("/claude pesquise tendências de energia solar", "auto")).toBe(true);
    expect(shouldUseClaudeTask("/deep crie um relatório executivo", "auto")).toBe(true);
  });

  it("ativa o roteamento automático para tarefas claramente profundas", () => {
    expect(shouldUseClaudeTask("Faça uma pesquisa sobre o mercado", "auto")).toBe(true);
    expect(shouldUseClaudeTask("Compare os resultados de duas cidades", "auto")).toBe(true);
    expect(shouldUseClaudeTask("Apenas me diga uma saudação", "auto")).toBe(false);
  });

  it("encaminha fontes externas para a pesquisa web Claude", () => {
    expect(shouldUseClaudeTask("Analise os comentários do YouTube sobre o tema", "auto")).toBe(true);
    expect(shouldUseClaudeTask("Compare o que aparece no Google e no Instagram", "auto")).toBe(true);
  });

  it("respeita a seleção explícita de Grok", () => {
    expect(shouldUseClaudeTask("/claude investigue o tema", "grok")).toBe(false);
  });

  it("trata o engine Manus legado como compatibilidade Claude", () => {
    expect(shouldUseClaudeTask("conversa simples", "manus")).toBe(true);
    expect(shouldUseClaudeTask("conversa simples", "claude")).toBe(true);
  });

  it("não considera a chave configurada quando o ambiente está vazio", () => {
    expect(isClaudeConfigured()).toBe(false);
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(isClaudeConfigured()).toBe(true);
  });

  it("anexa fontes sem duplicar a resposta quando não há citações", () => {
    expect(appendClaudeCitations("Resposta", [])).toBe("Resposta");
    expect(appendClaudeCitations("Resposta", [{ title: "Fonte", url: "https://example.com" }])).toContain("https://example.com");
  });
});

