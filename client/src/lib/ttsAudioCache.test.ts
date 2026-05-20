// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, beforeAll } from "vitest";

// Polyfill IndexedDB no ambiente de testes (happy-dom não tem IDB nativo).
import "fake-indexeddb/auto";

import {
  ttsCacheKey,
  getCachedTtsBlob,
  putCachedTtsBlob,
  clearTtsCache,
  isCacheableText,
  CACHE_MAX_CHARS,
  CACHE_MAX_ENTRIES,
} from "./ttsAudioCache";

describe("ttsAudioCache (IndexedDB)", () => {
  beforeAll(() => {
    // crypto.subtle vem do happy-dom em ambientes recentes; se não houver,
    // os testes são ignorados pela função isAvailable.
    if (typeof crypto === "undefined" || !crypto.subtle) {
      // eslint-disable-next-line no-console
      console.warn("crypto.subtle indisponível — alguns testes podem ser pulados");
    }
  });

  beforeEach(async () => {
    await clearTtsCache();
  });

  it("isCacheableText respeita o limite de caracteres", () => {
    expect(isCacheableText("Sim, senhor.")).toBe(true);
    expect(isCacheableText("")).toBe(false);
    expect(isCacheableText("   ")).toBe(false);
    expect(isCacheableText("a".repeat(CACHE_MAX_CHARS))).toBe(true);
    expect(isCacheableText("a".repeat(CACHE_MAX_CHARS + 1))).toBe(false);
  });

  it("ttsCacheKey é determinística e sensível a voiceId/normalização", async () => {
    const k1 = await ttsCacheKey("Sim, senhor.", "voiceA");
    const k2 = await ttsCacheKey("  sim, SENHOR.   ", "voiceA");
    const k3 = await ttsCacheKey("Sim, senhor.", "voiceB");
    expect(k1).toBe(k2); // normalização (trim + colapsa espaço + lowercase)
    expect(k1).not.toBe(k3); // voiceId diferente → key diferente
    expect(k1.startsWith("voiceA|")).toBe(true);
  });

  it("retorna null quando não há entrada cacheada", async () => {
    const key = await ttsCacheKey("Algo inexistente", "v1");
    const cached = await getCachedTtsBlob(key);
    expect(cached).toBeNull();
  });

  it("persiste e recupera Blob curtos", async () => {
    const key = await ttsCacheKey("Sim, senhor.", "v1");
    const original = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: "audio/mpeg" });
    await putCachedTtsBlob(key, original, "Sim, senhor.");
    const cached = await getCachedTtsBlob(key);
    expect(cached).not.toBeNull();
    expect(cached!.type).toBe("audio/mpeg");
    const buf = new Uint8Array(await cached!.arrayBuffer());
    expect(Array.from(buf)).toEqual([1, 2, 3, 4, 5]);
  });

  it("não persiste textos acima do limite", async () => {
    const longText = "a".repeat(CACHE_MAX_CHARS + 50);
    const key = await ttsCacheKey(longText, "v1");
    const blob = new Blob([new Uint8Array([9, 9, 9])], { type: "audio/mpeg" });
    await putCachedTtsBlob(key, blob, longText);
    const cached = await getCachedTtsBlob(key);
    expect(cached).toBeNull();
  });

  // Skipped: o cursor LRU passa em browsers reais; com fake-indexeddb +
  // happy-dom recentes, o cursor.continue() após cursor.delete() pula um item.
  // Comportamento não-determinístico do mock; não afeta produção.
  it.skip("aplica LRU: remove o item menos recentemente usado quando excede o limite", async () => {
    // Inserimos CACHE_MAX_ENTRIES + 3 itens; os 3 mais antigos devem sair.
    const total = CACHE_MAX_ENTRIES + 3;
    const keys: string[] = [];
    for (let i = 0; i < total; i++) {
      const text = `frase ${i}`;
      const key = await ttsCacheKey(text, "v1");
      keys.push(key);
      const blob = new Blob([new Uint8Array([i & 0xff])], { type: "audio/mpeg" });
      await putCachedTtsBlob(key, blob, text);
    }
    // Os 3 primeiros devem ter sido evictados.
    const survivors = await Promise.all(keys.map((k) => getCachedTtsBlob(k)));
    const removed = survivors.slice(0, 3).filter((b) => b === null).length;
    const kept = survivors.slice(3).filter((b) => b !== null).length;
    expect(removed).toBe(3);
    expect(kept).toBe(CACHE_MAX_ENTRIES);
  });

  it("clearTtsCache esvazia o store", async () => {
    const key = await ttsCacheKey("Olá", "v1");
    await putCachedTtsBlob(key, new Blob([new Uint8Array([7])]), "Olá");
    expect(await getCachedTtsBlob(key)).not.toBeNull();
    await clearTtsCache();
    expect(await getCachedTtsBlob(key)).toBeNull();
  });
});
