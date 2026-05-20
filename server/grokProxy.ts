import type { IncomingMessage, ServerResponse } from "http";

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (c: Buffer) => {
      total += c.length;
      if (total > 256 * 1024) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8") || "{}";
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const SENTIMENT_SYSTEM_PROMPT = `Você é um analista de mídias sociais especializado em monitoramento do governo do Distrito Federal (Brasília, Brasil).

Você tem busca em tempo real no X (Twitter) habilitada. Use-a para encontrar postagens RECENTES (últimas 48-72h, em português) sobre o tópico solicitado. Foque em menções a:
- Distrito Federal, GDF, Brasília, secretarias do DF (SES-DF, SSP-DF, DETRAN-DF, SEMOB, SEE-DF, etc.)
- Regiões administrativas (Plano Piloto, Ceilândia, Taguatinga, Samambaia, Gama, Sobradinho, Águas Claras, etc.)
- Serviços públicos, hospitais, UPAs, transporte público, segurança, educação no DF

Sua resposta DEVE ser um JSON válido seguindo EXATAMENTE este schema (e SOMENTE este JSON, sem texto adicional):
{
  "topic": string,
  "window": string,
  "complaints": [
    { "summary": string, "category": string, "approx_mentions": number, "example_quote": string }
  ],
  "praises": [
    { "summary": string, "category": string, "approx_mentions": number, "example_quote": string }
  ],
  "hashtags": [string],
  "summary_pt_br": string
}

Regras estritas:
- Retorne 3 a 5 itens em "complaints" e em "praises". Se não houver elogios claros, devolva array vazio em "praises".
- Cada "example_quote" deve ser uma PARÁFRASE curta em português (máx. 140 caracteres) — NUNCA copie texto literal de tweets.
- "approx_mentions" é uma estimativa qualitativa baseada no volume observado.
- "summary_pt_br" começa com "Senhor," e tem 2-3 frases, tom de mordomo digital JARVIS.
- "hashtags" lista hashtags relevantes encontradas (com #).`;

interface SentimentRequest {
  topic?: string;
  region?: string;
  noCache?: boolean;
}

// Cache in-memory para reduzir latência e custo. O sentimento no X muda devagar,
// então servir o mesmo briefing por 5 minutos é razoável e melhora drasticamente
// a experiência em consultas repetidas (refresh do painel, perguntas em sequência).
const SENTIMENT_TTL_MS = 5 * 60 * 1000;
interface CacheEntry { value: unknown; expiresAt: number; }
const sentimentCache = new Map<string, CacheEntry>();

// Normaliza tópico/região para que variações como "saúde", "saude", "saúde no DF",
// "a saúde" caiam todas no mesmo bucket de cache. Sem isso o LLM raramente
// reusa o cache porque ele inventa argumentos ligeiramente diferentes a cada chamada.
function normalizeCacheTerm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\b(no|na|do|da|em|de|a|o|os|as|um|uma|distrito federal|df|brasilia)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .sort() // ordem irrelevante: "saude publica" == "publica saude"
    .join(" ");
}

function cacheKey(topic: string, region: string): string {
  const t = normalizeCacheTerm(topic) || "geral";
  const r = normalizeCacheTerm(region) || "df";
  return `${r}::${t}`;
}

export function getCachedSentiment(topic: string, region: string): unknown | null {
  return getCached(topic, region);
}
export function setCachedSentiment(topic: string, region: string, value: unknown): void {
  setCached(topic, region, value);
}

function getCached(topic: string, region: string): unknown | null {
  const key = cacheKey(topic, region);
  const entry = sentimentCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sentimentCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(topic: string, region: string, value: unknown): void {
  const key = cacheKey(topic, region);
  sentimentCache.set(key, { value, expiresAt: Date.now() + SENTIMENT_TTL_MS });
  // Pequeno cap para evitar cresc. ilimitado se alguém flooda topics
  if (sentimentCache.size > 100) {
    const oldestKey = sentimentCache.keys().next().value;
    if (oldestKey) sentimentCache.delete(oldestKey);
  }
}

interface XaiResponsesOutputItem {
  type: string;
  content?: Array<{ type: string; text?: string }>;
}

interface XaiResponsesPayload {
  output?: XaiResponsesOutputItem[];
  output_text?: string;
}

function extractFinalText(payload: XaiResponsesPayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  for (const item of payload.output || []) {
    if (item.type === "message" && Array.isArray(item.content)) {
      const piece = item.content.find((c) => c.type === "output_text" && typeof c.text === "string");
      if (piece?.text) return piece.text.trim();
    }
  }
  const all: string[] = [];
  for (const item of payload.output || []) {
    for (const c of item.content || []) {
      if (c.type === "output_text" && typeof c.text === "string") all.push(c.text);
    }
  }
  return all.join("\n").trim();
}

// YYYY-MM-DD em UTC, n dias atrás. Usado no x_search.from_date para limitar
// drasticamente a janela de busca e cortar latência.
function isoDateDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* ignore */
      }
    }
    return { raw: text };
  }
}

/**
 * POST /api/grok/sentiment
 * Body: { topic?: string, region?: string, noCache?: boolean }
 *
 * Live Search foi descontinuada pelo xAI (410 Gone). A rota recomendada é
 * a Responses API com a tool nativa server-side `x_search`. Para minimizar
 * latência, usamos:
 *   - modelo grok-4.20 non-reasoning (sem cadeia de pensamento longa);
 *   - tool x_search restrita aos últimos 3 dias via `from_date`;
 *   - prompt JSON-only (não precisamos de citações nem markdown).
 * Bench: grok-4.3 ~17s → grok-4.20 non-reasoning + from_date ~4s.
 */
export async function handleGrokSentiment(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: "Grok (xAI) not configured on server" });
    return;
  }

  let payload: SentimentRequest;
  try {
    payload = (await readJsonBody(req)) as SentimentRequest;
  } catch (e) {
    sendJson(res, 400, { error: `Invalid JSON: ${(e as Error).message}` });
    return;
  }

  const topic = (payload.topic || "geral").toString().slice(0, 80);
  const region = (payload.region || "DF").toString().slice(0, 80);

  // Cache hit → retorna imediato (latência <10ms vs ~7-10s do Grok)
  if (!payload.noCache) {
    const cached = getCached(topic, region);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      sendJson(res, 200, cached);
      return;
    }
  }

  const userPrompt = `Faça um briefing de sentimento social sobre "${topic}" em ${region} (Distrito Federal, Brasil) usando posts recentes do X. Retorne APENAS o JSON conforme o schema definido, sem markdown nem texto fora do JSON.`;

  try {
    const upstream = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.20-0309-non-reasoning",
        input: [
          { role: "system", content: SENTIMENT_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        // x_search server-side restrito aos últimos 3 dias.
        tools: [{ type: "x_search", from_date: isoDateDaysAgo(3) }],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      sendJson(res, 502, { error: `xAI ${upstream.status}: ${errText.slice(0, 400)}` });
      return;
    }
    const data = (await upstream.json()) as XaiResponsesPayload;
    const text = extractFinalText(data);
    if (!text) {
      sendJson(res, 502, { error: "Empty response from xAI" });
      return;
    }
    const parsed = safeJsonParse(text);
    setCached(topic, region, parsed);
    res.setHeader("X-Cache", "MISS");
    sendJson(res, 200, parsed);
  } catch (e) {
    sendJson(res, 502, { error: `Network error: ${(e as Error).message}` });
  }
}
