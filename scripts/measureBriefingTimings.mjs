#!/usr/bin/env node
/**
 * measureBriefingTimings.mjs
 *
 * Força o JARVIS a chamar AMBAS as tools (buscar_dados_df + sentimento_social_df)
 * e mede o tempo de cada rodada de tool calling para diagnosticar onde está o
 * gargalo dos ~22s do briefing combinado frio.
 *
 * Saída: imprime os timings retornados pelo endpoint, separando o tempo gasto
 * no Forge (LLM) e o tempo gasto executando as tools em cada rodada.
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// Prompt explícito que força as duas tools
const FORCE_BOTH_TOOLS = "JARVIS, preciso de um briefing executivo sobre saúde no DF. Consulte obrigatoriamente os dados oficiais (buscar_dados_df) E o sentimento social no X (sentimento_social_df), depois combine os dois em uma resposta única.";

async function run(label, userMessage) {
  const t0 = Date.now();
  const resp = await fetch(`${BASE}/api/jarvis/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userMessage, history: [] }),
  });
  const total = Date.now() - t0;
  const data = await resp.json().catch(() => ({}));
  console.log(`\n=== ${label} ===`);
  console.log(`  total: ${total}ms`);
  console.log(`  status: ${resp.status}`);
  console.log(`  tools_used: ${JSON.stringify(data.tools_used)}`);
  console.log(`  reply_len: ${(data.reply || "").length}`);
  if (Array.isArray(data.timings) && data.timings.length > 0) {
    console.log(`  timings:`);
    let totalForge = 0;
    let totalTools = 0;
    for (const t of data.timings) {
      console.log(`    round=${t.round} forge=${t.forgeMs}ms tools=${t.toolsMs}ms (${JSON.stringify(t.toolNames)})`);
      totalForge += t.forgeMs;
      totalTools += t.toolsMs;
    }
    console.log(`  total_forge: ${totalForge}ms · total_tools: ${totalTools}ms`);
  } else {
    console.log(`  (sem timings — não chamou tools)`);
  }
  return { total, data };
}

async function main() {
  console.log("[1/3] Cold run (cache vazio)...");
  await run("COLD (forçando duas tools)", FORCE_BOTH_TOOLS);

  console.log("\n[2/3] Warm run (mesmo prompt, cache do Grok deve estar quente)...");
  await run("WARM (cache HIT do sentimento)", FORCE_BOTH_TOOLS);

  console.log("\n[3/3] Briefing curto sem forçar tools...");
  await run("Briefing rápido segurança DF", "JARVIS, briefing rápido sobre segurança pública no DF.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
