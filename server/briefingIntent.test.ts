import { describe, it, expect } from "vitest";
import { detectBriefingIntent } from "./jarvisProxy";

describe("detectBriefingIntent", () => {
  it("detecta briefing de saúde com acento", () => {
    const intent = detectBriefingIntent("me dá um briefing de saúde no DF");
    expect(intent).not.toBeNull();
    expect(intent?.topic).toBe("saude");
    expect(intent?.region).toBe("DF");
  });

  it("detecta briefing de saúde sem acento", () => {
    const intent = detectBriefingIntent("briefing de saude");
    expect(intent?.topic).toBe("saude");
  });

  it("detecta panorama de segurança", () => {
    const intent = detectBriefingIntent("qual o panorama de segurança hoje?");
    expect(intent?.topic).toBe("seguranca");
  });

  it("detecta 'o que estão falando' + tópico (transporte)", () => {
    const intent = detectBriefingIntent("o que estão falando sobre o metrô?");
    expect(intent?.topic).toBe("transporte");
  });

  it("detecta licitações via transparência", () => {
    const intent = detectBriefingIntent("resumo das licitações da semana");
    expect(intent?.topic).toBe("transparencia");
  });

  it("retorna null quando há tópico mas nenhuma palavra de briefing", () => {
    const intent = detectBriefingIntent("quantos hospitais existem?");
    expect(intent).toBeNull();
  });

  it("retorna null quando há briefing mas nenhum tópico claro", () => {
    const intent = detectBriefingIntent("me faz um resumo geral");
    expect(intent).toBeNull();
  });

  it("retorna null para perguntas que não são briefing nem tópico", () => {
    expect(detectBriefingIntent("oi, tudo bem?")).toBeNull();
    expect(detectBriefingIntent("que horas são?")).toBeNull();
  });

  it("é case-insensitive e tolera maiúsculas", () => {
    const intent = detectBriefingIntent("BRIEFING DE EDUCAÇÃO");
    expect(intent?.topic).toBe("educacao");
  });
});
