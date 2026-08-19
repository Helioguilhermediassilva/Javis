import { describe, it, expect } from "vitest";
import { matchWakeWord, WakeWordArmedWindow } from "./wakeWord";

describe("matchWakeWord", () => {
  it("casa formas canônicas com e sem prefixo", () => {
    expect(matchWakeWord("Xavier").matched).toBe(true);
    expect(matchWakeWord("Jarvis").matched).toBe(true);
    expect(matchWakeWord("JARVIS, briefing de saúde").matched).toBe(true);
    expect(matchWakeWord("Ei JARVIS").matched).toBe(true);
    expect(matchWakeWord("Olá Jarvis, tudo bem?").matched).toBe(true);
  });

  it("preserva acentuação e capitalização do comando", () => {
    const m = matchWakeWord("Ei JARVIS, mostre o briefing de Saúde no DF.");
    expect(m.matched).toBe(true);
    expect(m.command).toBe("mostre o briefing de Saúde no DF.");
  });

  it("aceita variantes comuns de erro de STT", () => {
    expect(matchWakeWord("Jarves").matched).toBe(true);
    expect(matchWakeWord("Jarvez briefing").matched).toBe(true);
    expect(matchWakeWord("Hey Jarvis").matched).toBe(true);
    // 'geralves' é um erro de STT comum em ambientes ruidosos
    expect(matchWakeWord("Geralves abra o painel").matched).toBe(true);
  });

  it("retorna comando vazio quando só falaram o wake-word", () => {
    expect(matchWakeWord("XAVIER.").command).toBe("");
    expect(matchWakeWord("JARVIS.").command).toBe("");
    expect(matchWakeWord("Ei JARVIS").command).toBe("");
    expect(matchWakeWord("oi jarvis,").command).toBe("");
  });

  it("não dispara para falas que não contêm o wake-word", () => {
    expect(matchWakeWord("vamos almoçar").matched).toBe(false);
    expect(matchWakeWord("o trânsito está ruim hoje").matched).toBe(false);
    expect(matchWakeWord("").matched).toBe(false);
    expect(matchWakeWord("   ").matched).toBe(false);
    // Wake-word no MEIO da frase NÃO conta — só no início (comportamento desejado
    // para evitar disparos quando alguém fala sobre o JARVIS em terceira pessoa)
    expect(matchWakeWord("o filme do JARVIS é legal").matched).toBe(false);
  });

  it("ignora pontuação e espaços extras antes do wake-word", () => {
    expect(matchWakeWord("  ei,  Xavier...   abra o painel").matched).toBe(true);
    expect(matchWakeWord("  ei,  Xavier...   abra o painel").command).toBe("abra o painel");
    expect(matchWakeWord("  ei,  Jarvis...   abra o painel").matched).toBe(true);
    expect(matchWakeWord("  ei,  Jarvis...   abra o painel").command).toBe("abra o painel");
  });
});

describe("WakeWordArmedWindow", () => {
  it("fica armada apenas pela janela configurada", () => {
    const w = new WakeWordArmedWindow(1000);
    expect(w.isArmed(0)).toBe(false);
    w.arm(0);
    expect(w.isArmed(500)).toBe(true);
    expect(w.isArmed(1000)).toBe(false);
    expect(w.isArmed(1001)).toBe(false);
  });

  it("disarm() cancela imediatamente", () => {
    const w = new WakeWordArmedWindow(1000);
    w.arm(0);
    expect(w.isArmed(500)).toBe(true);
    w.disarm();
    expect(w.isArmed(500)).toBe(false);
  });
});
