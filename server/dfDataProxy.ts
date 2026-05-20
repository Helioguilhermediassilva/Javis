import type { IncomingMessage, ServerResponse } from "http";
import { DF_CKAN_BASE, DF_TOPICS, type DfGroupSlug } from "./dfSources.js";

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

interface CkanSearchResult {
  count: number;
  results: Array<{
    id: string;
    name: string;
    title: string;
    notes?: string;
    organization?: { name: string; title?: string };
    metadata_modified?: string;
    groups?: Array<{ name: string; title?: string }>;
    resources?: Array<{
      id: string;
      name: string;
      format: string;
      url: string;
      description?: string;
      last_modified?: string;
    }>;
  }>;
}

/**
 * GET /api/df/topics → lista os 11 grupos temáticos do CKAN do DF.
 */
export function handleDfTopics(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, {
    topics: DF_TOPICS.map((t) => ({
      slug: t.slug,
      label: t.label,
      description: t.description,
    })),
  });
}

/**
 * GET /api/df/search?q=...&group=...&rows=10
 * Busca datasets no CKAN do DF, opcionalmente filtrando por grupo temático.
 */
export async function handleDfSearch(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  const url = new URL(req.url || "/", "http://localhost");
  const q = (url.searchParams.get("q") || "").trim();
  const group = (url.searchParams.get("group") || "").trim() as DfGroupSlug | "";
  const rows = Math.min(parseInt(url.searchParams.get("rows") || "10", 10) || 10, 25);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (group) params.set("fq", `groups:${group}`);
  params.set("rows", String(rows));
  params.set("sort", "metadata_modified desc");

  async function fetchCkan(qs: URLSearchParams): Promise<CkanSearchResult | null> {
    const r = await fetch(`${DF_CKAN_BASE}/package_search?${qs.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { success: boolean; result: CkanSearchResult };
    return j.success ? j.result : null;
  }

  try {
    let result = await fetchCkan(params);
    if (!result) {
      sendJson(res, 502, { error: "CKAN unavailable" });
      return;
    }
    let usedFallback: "none" | "group_only" | "query_only" = "none";
    // Se filtramos por grupo + query e veio vazio, tentamos sem a query (só grupo).
    if (result.count === 0 && q && group) {
      const fb = new URLSearchParams();
      fb.set("fq", `groups:${group}`);
      fb.set("rows", String(rows));
      fb.set("sort", "metadata_modified desc");
      const fbResult = await fetchCkan(fb);
      if (fbResult && fbResult.count > 0) {
        result = fbResult;
        usedFallback = "group_only";
      }
    }
    // Se filtramos por grupo (sem query) e veio vazio, tentamos só com a query global.
    if (result.count === 0 && q && !group) {
      // já é só query — nada a fazer.
      usedFallback = "none";
    }
    const datasets = result.results.map((d) => ({
      id: d.id,
      name: d.name,
      title: d.title,
      notes: (d.notes || "").slice(0, 500),
      org: d.organization?.title || d.organization?.name || null,
      groups: (d.groups || []).map((g) => g.name),
      modified: d.metadata_modified || null,
      resources: (d.resources || []).slice(0, 5).map((r) => ({
        id: r.id,
        name: r.name,
        format: r.format,
        url: r.url,
        description: (r.description || "").slice(0, 200),
        modified: r.last_modified || null,
      })),
    }));
    sendJson(res, 200, { count: result.count, datasets, fallback: usedFallback });
  } catch (e) {
    sendJson(res, 502, { error: `Network error: ${(e as Error).message}` });
  }
}

/**
 * GET /api/df/dataset/:id → detalhes completos de um dataset.
 */
export async function handleDfDataset(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  const url = new URL(req.url || "/", "http://localhost");
  const id = url.pathname.replace(/^\/api\/df\/dataset\//, "").trim();
  if (!id) {
    sendJson(res, 400, { error: "dataset id required" });
    return;
  }
  try {
    const upstream = await fetch(`${DF_CKAN_BASE}/package_show?id=${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!upstream.ok) {
      sendJson(res, 502, { error: `CKAN ${upstream.status}` });
      return;
    }
    const json = (await upstream.json()) as { success: boolean; result: CkanSearchResult["results"][number] };
    if (!json.success) {
      sendJson(res, 404, { error: "Dataset not found" });
      return;
    }
    const d = json.result;
    sendJson(res, 200, {
      id: d.id,
      name: d.name,
      title: d.title,
      notes: d.notes || "",
      org: d.organization?.title || d.organization?.name || null,
      groups: (d.groups || []).map((g) => g.name),
      modified: d.metadata_modified || null,
      resources: (d.resources || []).map((r) => ({
        id: r.id,
        name: r.name,
        format: r.format,
        url: r.url,
        description: r.description || "",
        modified: r.last_modified || null,
      })),
    });
  } catch (e) {
    sendJson(res, 502, { error: `Network error: ${(e as Error).message}` });
  }
}
