import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Brain, CheckCircle2, Loader2, LogOut, Save, ShieldCheck, Trash2, AlertTriangle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { xavierApi } from "@/lib/xavierApi";

interface MemoryProfile {
  memory_enabled: boolean;
  retention_days: number;
  monthly_message_limit: number;
}

interface MemorySummary {
  id: string;
  conversation_id: string | null;
  summary: string;
  source_message_count: number;
  pinned: boolean;
  updated_at: string;
}

interface MemoryResponse {
  profile: MemoryProfile;
  summaries: MemorySummary[];
}

export default function MemorySettings() {
  const [, navigate] = useLocation();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<MemoryProfile | null>(null);
  const [summaries, setSummaries] = useState<MemorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const loadMemory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await xavierApi<MemoryResponse>("/api/xavier/memory");
      setProfile(response.profile);
      setSummaries(response.summaries || []);
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Não foi possível carregar a memória." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMemory(); }, [loadMemory]);

  async function savePreferences() {
    if (!profile) return;
    setSaving(true);
    setFeedback(null);
    try {
      const response = await xavierApi<{ profile: MemoryProfile }>("/api/xavier/profile", {
        method: "PATCH",
        body: JSON.stringify(profile),
      });
      setProfile(response.profile);
      setFeedback({ type: "success", text: "Preferências de memória atualizadas." });
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Não foi possível salvar as preferências." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteMemory() {
    const confirmed = window.confirm("Apagar todo o histórico, resumos, conexões Telegram e preferências do Xavier desta conta? Esta ação não pode ser desfeita.");
    if (!confirmed) return;
    setDeleting(true);
    setFeedback(null);
    try {
      await xavierApi("/api/xavier/memory", { method: "DELETE" });
      setSummaries([]);
      setFeedback({ type: "success", text: "Todos os dados da memória foram apagados." });
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Não foi possível apagar a memória." });
    } finally {
      setDeleting(false);
    }
  }

  async function logout() {
    await signOut();
    navigate("/");
  }

  return (
    <main className="min-h-screen overflow-y-auto bg-[#00060a] px-4 py-8 text-[#8ffcff] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#0d3347] pb-5">
          <div className="flex items-center gap-3"><Brain className="h-7 w-7 text-[#00d4ff]" /><div><div className="text-sm font-bold tracking-[0.3em] text-[#d8f8ff]">XAVIER / MEMÓRIA</div><div className="mt-1 text-[10px] tracking-[0.18em] text-[#3a8a9a]">CONTA {user?.email || "AUTENTICADA"}</div></div></div>
          <div className="flex items-center gap-2"><Link href="/" className="flex items-center gap-2 border border-[#0d3347] px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-[#5ab8cc] transition hover:border-[#00d4ff] hover:text-[#d8f8ff]"><ArrowLeft className="h-3.5 w-3.5" /> Cockpit</Link><button type="button" onClick={() => void logout()} className="flex items-center gap-2 border border-[#0d3347] px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-[#5ab8cc] transition hover:border-[#ff3355] hover:text-[#ff9aac]"><LogOut className="h-3.5 w-3.5" /> Sair</button></div>
        </header>

        {feedback && <div className={`mb-6 flex gap-3 border p-4 text-xs leading-5 ${feedback.type === "error" ? "border-[#ff3355]/50 bg-[#ff3355]/10 text-[#ff9aac]" : "border-[#00ff88]/40 bg-[#00ff88]/10 text-[#8dffc2]"}`}>{feedback.type === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}{feedback.text}</div>}

        {loading || !profile ? <div className="flex items-center gap-3 border border-[#0d3347] bg-[#010d14] p-6 text-xs text-[#5ab8cc]"><Loader2 className="h-4 w-4 animate-spin" /> CARREGANDO MEMÓRIA...</div> : <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="border border-[#0d3347] bg-[#010d14] p-6 shadow-[0_0_40px_rgba(0,212,255,.06)] sm:p-8">
            <p className="text-[10px] tracking-[0.22em] text-[#ff6b00]">CONTROLES DE MEMÓRIA</p>
            <h1 className="mt-2 text-2xl font-semibold text-[#d8f8ff]">Como o Xavier se lembra</h1>
            <p className="mt-3 text-sm leading-6 text-[#5ab8cc]">O histórico bruto é limitado por retenção. Conversas mais antigas podem gerar um resumo compacto, sem nova chamada ao modelo, para preservar continuidade com baixo custo.</p>

            <label className="mt-8 flex items-center justify-between gap-4 border border-[#0d3347] bg-[#00060a] p-4"><span><span className="block text-xs font-semibold text-[#d8f8ff]">Memória persistente</span><span className="mt-1 block text-[11px] leading-5 text-[#5ab8cc]">Quando desligada, o Xavier ainda responde, mas não usa nem grava novos contextos.</span></span><input type="checkbox" checked={profile.memory_enabled} onChange={(event) => setProfile({ ...profile, memory_enabled: event.target.checked })} className="h-5 w-5 accent-[#00d4ff]" /></label>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-[#3a8a9a]">Retenção bruta (dias)</span><input type="number" min={7} max={3650} value={profile.retention_days} onChange={(event) => setProfile({ ...profile, retention_days: Number(event.target.value) || 90 })} className="w-full border border-[#0d3347] bg-[#00060a] px-3 py-3 text-sm text-[#d8f8ff] outline-none focus:border-[#00d4ff]" /><span className="mt-2 block text-[10px] text-[#3a8a9a]">Mínimo recomendado: 7 dias.</span></label>
              <label className="block"><span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-[#3a8a9a]">Mensagens por mês</span><input type="number" min={10} max={100000} value={profile.monthly_message_limit} onChange={(event) => setProfile({ ...profile, monthly_message_limit: Number(event.target.value) || 1000 })} className="w-full border border-[#0d3347] bg-[#00060a] px-3 py-3 text-sm text-[#d8f8ff] outline-none focus:border-[#00d4ff]" /><span className="mt-2 block text-[10px] text-[#3a8a9a]">Protege contra uso inesperado.</span></label>
            </div>

            <button type="button" disabled={saving} onClick={() => void savePreferences()} className="mt-6 flex items-center justify-center gap-2 bg-[#00d4ff] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#00060a] transition hover:bg-[#8ffcff] disabled:cursor-wait disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? "SALVANDO..." : "SALVAR PREFERÊNCIAS"}</button>

            <div className="mt-8 border-t border-[#0d3347] pt-5"><p className="text-[10px] uppercase tracking-[0.18em] text-[#ff3355]">ZONA DE PRIVACIDADE</p><p className="mt-2 text-xs leading-5 text-[#5ab8cc]">Apagar a memória remove mensagens, resumos, conexões Telegram, limites de uso e preferências desta conta. A conta de autenticação permanece disponível para um novo começo.</p><button type="button" disabled={deleting} onClick={() => void deleteMemory()} className="mt-4 flex items-center gap-2 border border-[#ff3355]/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#ff9aac] transition hover:bg-[#ff3355]/10 disabled:opacity-50"><Trash2 className="h-4 w-4" /> {deleting ? "APAGANDO..." : "APAGAR TODA A MEMÓRIA"}</button></div>
          </section>

          <aside className="space-y-6">
            <section className="border border-[#0d3347] bg-[#010d14] p-6"><div className="flex items-center gap-2 text-[10px] tracking-[0.22em] text-[#ff6b00]"><ShieldCheck className="h-4 w-4" /> DADOS CONTROLADOS</div><h2 className="mt-2 text-lg font-semibold text-[#d8f8ff]">Resumo do cérebro</h2><p className="mt-3 text-sm leading-6 text-[#5ab8cc]">O Xavier não recebe o banco inteiro a cada pergunta. Ele usa o resumo compacto e os últimos turnos da conversa, separados por conta e por canal.</p><div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#0d3347] pt-4 text-[10px]"><div><span className="text-[#3a8a9a]">RESUMOS</span><div className="mt-1 text-lg text-[#d8f8ff]">{summaries.length}</div></div><div><span className="text-[#3a8a9a]">RETENÇÃO</span><div className="mt-1 text-lg text-[#d8f8ff]">{profile.retention_days}d</div></div></div></section>
            <section className="border border-[#0d3347] bg-[#010d14] p-6"><p className="text-[10px] tracking-[0.22em] text-[#ff6b00]">MEMÓRIAS COMPACTADAS</p>{summaries.length === 0 ? <p className="mt-4 text-sm leading-6 text-[#5ab8cc]">Ainda não há resumo de longo prazo. Ele será criado automaticamente após os primeiros marcos de conversa.</p> : <div className="mt-4 space-y-4">{summaries.map((item) => <article key={item.id} className="border border-[#0d3347] bg-[#00060a] p-4"><div className="flex items-center justify-between gap-3 text-[10px] text-[#3a8a9a]"><span>{item.source_message_count} mensagens de origem</span><span>{new Date(item.updated_at).toLocaleDateString("pt-BR")}</span></div><p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-[#8ffcff]">{item.summary}</p></article>)}</div>}</section>
          </aside>
        </div>}
      </div>
    </main>
  );
}
