#!/usr/bin/env node
/**
 * measureLatency.mjs
 *
 * Mede objetivamente a latência do pipeline JARVIS:
 *  - TTS streaming (turbo + chunked):
 *      tFirstByte:  ms até o primeiro byte do MP3 chegar (proxy do "começa a falar")
 *      tLastByte:   ms até o stream encerrar
 *      mp3Bytes:    tamanho total
 *  - Chat (LLM) sozinho (sem tools):
 *      tChat:       ms até a resposta JSON
 *  - Briefing combinado (chat com tool calling buscar_dados_df + sentimento_social_df):
 *      tColdBriefing:    primeira chamada (cache MISS)
 *      tWarmBriefing:    chamada repetida (cache HIT esperado)
 *
 * Saída JSON estruturada para validar contra as metas:
 *   - voz começa a tocar em < 1s   (tFirstByte; meta originalmente otimista)
 *   - briefing combinado < 5s      (tColdBriefing)
 *   - consulta repetida < 2s       (tWarmBriefing)
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

async function measureTTS(text) {
  const t0 = performance.now();
  const resp = await fetch(`${BASE}/api/jarvis/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok || !resp.body) {
    return { ok: false, status: resp.status, text: await resp.text().catch(() => "") };
  }
  const reader = resp.body.getReader();
  let firstByteAt = null;
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.length > 0) {
      if (firstByteAt === null) firstByteAt = performance.now();
      total += value.length;
    }
  }
  const t1 = performance.now();
  return {
    ok: true,
    status: resp.status,
    contentType: resp.headers.get("content-type"),
    transferEncoding: resp.headers.get("transfer-encoding"),
    tFirstByte: firstByteAt === null ? null : Math.round(firstByteAt - t0),
    tLastByte: Math.round(t1 - t0),
    mp3Bytes: total,
  };
}

async function measureChat(message) {
  const t0 = performance.now();
  const resp = await fetch(`${BASE}/api/jarvis/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userMessage: message, history: [] }),
  });
  const t1 = performance.now();
  const ok = resp.ok;
  let body = null;
  try { body = await resp.json(); } catch {}
  return {
    ok,
    status: resp.status,
    duration: Math.round(t1 - t0),
    toolsUsed: body?.tools_used ?? null,
    replyLen: body?.reply ? body.reply.length : 0,
  };
}

async function main() {
  const out = {};
  out.tts_short = await measureTTS("Confirmação de áudio.");
  out.tts_medium = await measureTTS("Bom dia, senhor. Sistemas operacionais e prontos para suas ordens.");
  out.chat_simple = await measureChat("JARVIS, diga apenas: olá.");
  out.briefing_cold = await measureChat("JARVIS, briefing rápido de educação no DF.");
  // Repetir o mesmo briefing para forçar cache HIT no sentimento_social_df
  out.briefing_warm = await measureChat("JARVIS, briefing rápido de educação no DF.");
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
