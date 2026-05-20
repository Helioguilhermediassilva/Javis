import { describe, it, expect } from "vitest";

/**
 * Testes de integração das fontes ao vivo do JARVIS:
 *  1. Portal de dados abertos do DF (CKAN público)
 *  2. xAI Responses API com tool x_search (briefing social, modelo non-reasoning)
 *
 * Esses testes batem na rede de verdade, então:
 *  - Marcamos como skip quando a chave xAI não está disponível.
 *  - Usamos timeouts longos (CKAN ~5s, xAI ~90s).
 */

const CKAN = "https://dados.df.gov.br/api/3/action/package_search";

describe("Fontes DF: CKAN", () => {
  it("retorna datasets quando filtramos por grupo 'saude'", async () => {
    const r = await fetch(`${CKAN}?fq=groups:saude&rows=3`, {
      signal: AbortSignal.timeout(15_000),
    });
    expect(r.ok).toBe(true);
    const j = (await r.json()) as {
      success: boolean;
      result: { count: number; results: Array<{ title: string; organization?: { title?: string } }> };
    };
    expect(j.success).toBe(true);
    expect(j.result.count).toBeGreaterThan(0);
    expect(Array.isArray(j.result.results)).toBe(true);
    // Pelo menos um dataset com título legível.
    expect(j.result.results[0].title.length).toBeGreaterThan(3);
  }, 20_000);

  it("retorna datasets para o grupo 'seguranca'", async () => {
    const r = await fetch(`${CKAN}?fq=groups:seguranca&rows=3`, {
      signal: AbortSignal.timeout(15_000),
    });
    expect(r.ok).toBe(true);
    const j = (await r.json()) as {
      success: boolean;
      result: { count: number; results: Array<{ title: string }> };
    };
    expect(j.success).toBe(true);
    expect(j.result.count).toBeGreaterThan(0);
  }, 20_000);
});

describe("Fontes DF: xAI (Grok) Responses API com x_search", () => {
  const apiKey = process.env.XAI_API_KEY;
  const skip = !apiKey;

  it.skipIf(skip)(
    "consulta o X em tempo real e devolve uma resposta com 'ok' (grok-4.20 non-reasoning)",
    async () => {
      const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const r = await fetch("https://api.x.ai/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.20-0309-non-reasoning",
          input: [
            {
              role: "system",
              content:
                "Use a tool x_search para coletar 3 posts em pt-BR sobre o tópico no DF/Brasília. Devolva APENAS um texto contendo a palavra 'ok'. Sem markdown.",
            },
            { role: "user", content: "Briefing rápido sobre saúde no DF. Responda 'ok'." },
          ],
          tools: [{ type: "x_search", from_date: since }],
        }),
        signal: AbortSignal.timeout(75_000),
      });
      expect(r.ok).toBe(true);
      const data = (await r.json()) as {
        output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
      };
      let text = "";
      for (const item of data.output || []) {
        for (const c of item.content || []) {
          if (c.type === "output_text" && typeof c.text === "string") text += c.text;
        }
      }
      expect(text.length).toBeGreaterThan(1);
      expect(text.toLowerCase()).toContain("ok");
    },
    90_000,
  );
});
