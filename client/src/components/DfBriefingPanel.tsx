import { useEffect, useRef, useState } from "react";

/**
 * Painel de briefing social ao vivo sobre o DF.
 * Consulta /api/grok/sentiment a cada `refreshMs` ms e mostra top reclamações,
 * top elogios e hashtags em tempo real, no estilo HUD do JARVIS.
 */

interface SentimentItem {
  summary: string;
  category?: string;
  approx_mentions?: number;
}

interface SentimentPayload {
  topic?: string;
  window?: string;
  complaints?: SentimentItem[];
  praises?: SentimentItem[];
  hashtags?: string[];
  summary_pt_br?: string;
  error?: string;
}

interface DfBriefingPanelProps {
  topic?: string;
  region?: string;
  refreshMs?: number;
}

const TOPIC_OPTIONS = [
  { value: "geral", label: "GERAL" },
  { value: "saúde", label: "SAÚDE" },
  { value: "segurança", label: "SEGURANÇA" },
  { value: "transporte", label: "MOBILIDADE" },
  { value: "educação", label: "EDUCAÇÃO" },
];

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function DfBriefingPanel({
  topic: initialTopic = "geral",
  region = "DF",
  refreshMs = 15 * 60 * 1000,
}: DfBriefingPanelProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [data, setData] = useState<SentimentPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchBriefing = async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("/api/grok/sentiment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, region }),
          signal: controller.signal,
        });
        if (!r.ok) {
          const errBody = await r.text().catch(() => "");
          throw new Error(`HTTP ${r.status}${errBody ? `: ${errBody.slice(0, 80)}` : ""}`);
        }
        const json = (await r.json()) as SentimentPayload;
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
          setLastFetched(Date.now());
        }
      } catch (e) {
        if (cancelled || (e as Error).name === "AbortError") return;
        setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBriefing();
    const id = setInterval(fetchBriefing, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [topic, region, refreshMs]);

  return (
    <div
      className="border border-cyan-500/30 bg-cyan-500/5 p-2 text-[10px] uppercase"
      style={{ color: "#7DD3FC", fontFamily: "JetBrains Mono, monospace" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <span className="text-cyan-300">▸ BRIEFING SOCIAL · {region}</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] opacity-70">
          {loading && <span className="text-amber-400 animate-pulse">SYNC...</span>}
          {!loading && lastFetched && <span>{formatTime(lastFetched)}</span>}
        </div>
      </div>

      {/* Topic selector */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {TOPIC_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTopic(opt.value)}
            className={`px-1.5 py-0.5 border text-[9px] transition ${
              topic === opt.value
                ? "border-cyan-400 bg-cyan-400/20 text-cyan-200"
                : "border-cyan-500/30 hover:border-cyan-400/60 hover:bg-cyan-400/10"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-red-400 text-[9px] py-1 break-words">ERRO: {error}</div>
      )}

      {!error && !data && loading && (
        <div className="opacity-70 py-2">Coletando menções no X...</div>
      )}

      {!error && data && (
        <div className="space-y-2">
          {data.summary_pt_br && (
            <div
              className="text-[10px] leading-tight border-l-2 border-cyan-400/60 pl-2 py-1"
              style={{ textTransform: "none", color: "#BAE6FD" }}
            >
              {data.summary_pt_br}
            </div>
          )}

          {Array.isArray(data.complaints) && data.complaints.length > 0 && (
            <div>
              <div className="text-red-400 text-[9px] mb-1">▼ TOP RECLAMAÇÕES</div>
              <ul className="space-y-1">
                {data.complaints.slice(0, 3).map((c, i) => (
                  <li key={i} className="leading-tight" style={{ textTransform: "none" }}>
                    <span className="text-red-300">[{c.approx_mentions ?? "?"}]</span>{" "}
                    <span className="text-cyan-100">{c.summary}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(data.praises) && data.praises.length > 0 && (
            <div>
              <div className="text-emerald-400 text-[9px] mb-1">▲ TOP ELOGIOS / O QUE DÁ CERTO</div>
              <ul className="space-y-1">
                {data.praises.slice(0, 3).map((p, i) => (
                  <li key={i} className="leading-tight" style={{ textTransform: "none" }}>
                    <span className="text-emerald-300">[{p.approx_mentions ?? "?"}]</span>{" "}
                    <span className="text-cyan-100">{p.summary}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(data.hashtags) && data.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1 border-t border-cyan-500/20">
              {data.hashtags.slice(0, 6).map((h, i) => (
                <span key={i} className="text-[9px] text-cyan-400/80">
                  {h}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
