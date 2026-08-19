import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  MessageCircle,
  Power,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { xavierApi } from "@/lib/xavierApi";

interface TelegramStatus {
  connected: boolean;
  connection?: {
    id: string;
    bot_username?: string | null;
    bot_display_name?: string | null;
    bot_chat_url?: string | null;
    status: string;
    last_error?: string | null;
    last_verified_at?: string | null;
  };
  webhook?: {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
  } | null;
  error?: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function isTechnicalWebhookMessage(message: string): boolean {
  return /wrong response from the webhook|500 internal server error|webhook.*(5\d\d|failed|failure)/i.test(message);
}

function friendlyTelegramError(error: unknown, fallback: string): string {
  const message = getErrorMessage(error);
  if (isTechnicalWebhookMessage(message)) return "Não foi possível atualizar o status do Telegram agora. Tente novamente em alguns instantes.";
  return message || fallback;
}

function webhookNotice(status: TelegramStatus | null): string | null {
  const message = status?.webhook?.last_error_message || status?.error || "";
  return message && !isTechnicalWebhookMessage(message) ? message : null;
}

export default function TelegramConnect() {
  const [, navigate] = useLocation();
  const { user, signOut } = useAuth();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [chatCopied, setChatCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setStatus(await xavierApi<TelegramStatus>("/api/telegram/status"));
    } catch (error) {
      setFeedback({ type: "error", text: friendlyTelegramError(error, "Não foi possível consultar a conexão.") });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function connect() {
    if (!token.trim()) {
      setFeedback({ type: "error", text: "Cole o token recebido do @BotFather." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const result = await xavierApi<{ connection: TelegramStatus["connection"] }>(
        "/api/telegram/connect",
        { method: "POST", body: JSON.stringify({ botToken: token.trim() }) },
      );
      setToken("");
      setFeedback({
        type: "success",
        text: `@${result.connection?.bot_username || "Xavier"} conectado e configurado como Xavier. O webhook já foi registrado automaticamente.`,
      });
      await loadStatus();
    } catch (error) {
      setFeedback({ type: "error", text: friendlyTelegramError(error, "Não foi possível conectar o bot.") });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Desconectar este bot Telegram do Xavier?")) return;
    setBusy(true);
    setFeedback(null);
    try {
      await xavierApi("/api/telegram/disconnect", { method: "POST" });
      setStatus({ connected: false });
      setFeedback({ type: "success", text: "Bot desconectado. O histórico permanece associado à sua conta até ser apagado." });
    } catch (error) {
      setFeedback({ type: "error", text: friendlyTelegramError(error, "Não foi possível desconectar o bot.") });
    } finally {
      setBusy(false);
    }
  }

  async function copyTokenHint() {
    await navigator.clipboard?.writeText("/newbot");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function copyChatLink(chatUrl: string) {
    await navigator.clipboard?.writeText(chatUrl);
    setChatCopied(true);
    window.setTimeout(() => setChatCopied(false), 1800);
  }

  async function logout() {
    await signOut();
    navigate("/");
  }

  const botChatUrl = status?.connection?.bot_chat_url
    || (status?.connection?.bot_username ? `https://t.me/${status.connection.bot_username}` : null);

  return (
    <main className="min-h-screen overflow-y-auto bg-[#00060a] px-4 py-8 text-[#8ffcff] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#0d3347] pb-5">
          <div className="flex items-center gap-3">
            <Bot className="h-7 w-7 text-[#00d4ff]" />
            <div>
              <div className="text-sm font-bold tracking-[0.3em] text-[#d8f8ff]">XAVIER / TELEGRAM LINK</div>
              <div className="mt-1 text-[10px] tracking-[0.18em] text-[#3a8a9a]">CONTA {user?.email || "AUTENTICADA"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 border border-[#0d3347] px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-[#5ab8cc] transition hover:border-[#00d4ff] hover:text-[#d8f8ff]"><ArrowLeft className="h-3.5 w-3.5" /> Cockpit</Link>
            <button type="button" onClick={() => void logout()} className="flex items-center gap-2 border border-[#0d3347] px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-[#5ab8cc] transition hover:border-[#ff3355] hover:text-[#ff9aac]"><LogOut className="h-3.5 w-3.5" /> Sair</button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="border border-[#0d3347] bg-[#010d14] p-6 shadow-[0_0_40px_rgba(0,212,255,.06)] sm:p-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] tracking-[0.22em] text-[#ff6b00]">BOT CONNECTION</p>
                <h1 className="mt-2 text-2xl font-semibold text-[#d8f8ff]">Seu canal Telegram</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#5ab8cc]">Cada conta conecta o próprio bot. O token é enviado diretamente ao backend, cifrado antes de ser armazenado e nunca reaparece na tela.</p>
              </div>
              <MessageCircle className="hidden h-10 w-10 text-[#00d4ff]/60 sm:block" />
            </div>

            {feedback && <div className={`mb-6 flex gap-3 border p-4 text-xs leading-5 ${feedback.type === "error" ? "border-[#ff3355]/50 bg-[#ff3355]/10 text-[#ff9aac]" : "border-[#00ff88]/40 bg-[#00ff88]/10 text-[#8dffc2]"}`}>{feedback.type === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}{feedback.text}</div>}

            {loading ? (
              <div className="flex items-center gap-3 border border-[#0d3347] p-5 text-xs text-[#5ab8cc]"><Loader2 className="h-4 w-4 animate-spin" /> CONSULTANDO STATUS...</div>
            ) : status?.connected ? (
              <div className="border border-[#00ff88]/40 bg-[#00ff88]/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#8dffc2]"><CheckCircle2 className="h-4 w-4" /> CONECTADO</div>
                    <div className="mt-2 text-lg text-[#d8f8ff]">@{status.connection?.bot_username || status.connection?.bot_display_name || "Xavier"}</div>
                    <div className="mt-1 text-xs text-[#5ab8cc]">Webhook ativo e separado para a sua conta.</div>
                  </div>
                  <button type="button" disabled={busy} onClick={() => void disconnect()} className="flex items-center gap-2 border border-[#ff3355]/50 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[#ff9aac] transition hover:bg-[#ff3355]/10 disabled:opacity-50"><Unplug className="h-3.5 w-3.5" /> Desconectar</button>
                </div>

                <div className="mt-5 grid gap-3 border-t border-[#00ff88]/20 pt-4 text-[10px] text-[#5ab8cc] sm:grid-cols-2">
                  <div><span className="text-[#3a8a9a]">PENDÊNCIAS TELEGRAM</span><div className="mt-1 text-[#d8f8ff]">{status.webhook?.pending_update_count ?? 0}</div></div>
                  <div><span className="text-[#3a8a9a]">ÚLTIMA VERIFICAÇÃO</span><div className="mt-1 text-[#d8f8ff]">{status.connection?.last_verified_at ? new Date(status.connection.last_verified_at).toLocaleString("pt-BR") : "—"}</div></div>
                </div>

                {botChatUrl && <div className="mt-5 grid gap-5 border-t border-[#00ff88]/20 pt-5 sm:grid-cols-[190px_1fr] sm:items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="bg-[#d8f8ff] p-2"><QRCodeSVG value={botChatUrl} size={170} bgColor="#d8f8ff" fgColor="#00060a" includeMargin /></div>
                    <span className="text-center text-[9px] uppercase tracking-[0.16em] text-[#3a8a9a]">Escaneie para abrir</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#d8f8ff]"><MessageCircle className="h-4 w-4 text-[#00d4ff]" /> Chat do Xavier</div>
                    <p className="mt-2 text-xs leading-5 text-[#5ab8cc]">O QR Code contém somente o link público do bot. O token permanece cifrado no backend.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={botChatUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-[#00d4ff] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#00060a] transition hover:bg-[#8ffcff]"><ExternalLink className="h-3.5 w-3.5" /> Abrir no Telegram</a>
                      <button type="button" onClick={() => void copyChatLink(botChatUrl)} className="flex items-center gap-2 border border-[#0d3347] px-3 py-2 text-[10px] uppercase tracking-[0.13em] text-[#5ab8cc] transition hover:border-[#00d4ff] hover:text-[#d8f8ff]"><Copy className="h-3.5 w-3.5" /> {chatCopied ? "Link copiado" : "Copiar link"}</button>
                    </div>
                    <div className="mt-3 break-all font-mono text-[10px] text-[#3a8a9a]">{botChatUrl}</div>
                  </div>
                </div>}

                {webhookNotice(status) && <div className="mt-4 border-t border-[#ff3355]/20 pt-3 text-xs text-[#ff9aac]">{webhookNotice(status)}</div>}
              </div>
            ) : (
              <div>
                <label className="block"><span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-[#3a8a9a]">Token do @BotFather</span><input type="password" value={token} onChange={(event) => setToken(event.target.value)} className="w-full border border-[#0d3347] bg-[#00060a] px-4 py-3 font-mono text-sm text-[#d8f8ff] outline-none transition placeholder:text-[#28596a] focus:border-[#00d4ff]" placeholder="123456789:AA..." autoComplete="off" /></label>
                <button type="button" disabled={busy} onClick={() => void connect()} className="mt-4 flex w-full items-center justify-center gap-2 bg-[#00d4ff] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#00060a] transition hover:bg-[#8ffcff] disabled:cursor-wait disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />} Conectar bot</button>
                <div className="mt-4 flex items-center gap-2 text-[10px] leading-5 text-[#3a8a9a]"><ShieldCheck className="h-4 w-4 shrink-0 text-[#00ff88]" /> O token não é salvo no navegador.</div>
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="border border-[#0d3347] bg-[#010d14] p-6"><p className="text-[10px] tracking-[0.22em] text-[#ff6b00]">COMO CONECTAR</p><h2 className="mt-2 text-lg font-semibold text-[#d8f8ff]">1. Crie ou escolha seu bot</h2><ol className="mt-4 space-y-4 text-sm leading-6 text-[#5ab8cc]"><li><span className="mr-2 text-[#00d4ff]">01</span> Abra o Telegram e converse com <strong className="text-[#d8f8ff]">@BotFather</strong>.</li><li><span className="mr-2 text-[#00d4ff]">02</span> Envie <code className="border border-[#0d3347] bg-[#00060a] px-2 py-1 text-xs text-[#d8f8ff]">/newbot</code> e siga as instruções.</li><li><span className="mr-2 text-[#00d4ff]">03</span> Copie o token gerado e cole no campo ao lado.</li></ol><button type="button" onClick={() => void copyTokenHint()} className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.13em] text-[#00d4ff] hover:text-[#8ffcff]"><Copy className="h-3.5 w-3.5" /> {copied ? "Copiado" : "Copiar comando /newbot"}</button><a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.13em] text-[#5ab8cc] hover:text-[#d8f8ff]"><ExternalLink className="h-3.5 w-3.5" /> Abrir BotFather</a></section>
            <section className="border border-[#0d3347] bg-[#010d14] p-6"><p className="text-[10px] tracking-[0.22em] text-[#ff6b00]">NOME DO BOT</p><h2 className="mt-2 text-lg font-semibold text-[#d8f8ff]">Xavier — Inteligência Soberana</h2><p className="mt-3 text-sm leading-6 text-[#5ab8cc]">Ao conectar, o backend configura automaticamente o nome exibido, a descrição, a descrição curta e os comandos básicos do bot. O identificador @ do Telegram permanece o que foi emitido pelo @BotFather.</p><div className="mt-5 flex items-center gap-2 border-t border-[#0d3347] pt-4 text-[10px] uppercase tracking-[0.12em] text-[#00ff88]"><ShieldCheck className="h-4 w-4" /> Token protegido no servidor</div></section>
            <section className="border border-[#0d3347] bg-[#010d14] p-6"><p className="text-[10px] tracking-[0.22em] text-[#ff6b00]">MEMÓRIA E CUSTO</p><h2 className="mt-2 text-lg font-semibold text-[#d8f8ff]">Contexto econômico</h2><p className="mt-3 text-sm leading-6 text-[#5ab8cc]">O Xavier registra texto e metadados mínimos, aplica limite mensal por conta e não guarda áudio bruto. O histórico antigo será resumido e a memória poderá ser desligada ou apagada no painel.</p><div className="mt-5 flex items-center gap-2 border-t border-[#0d3347] pt-4 text-[10px] uppercase tracking-[0.12em] text-[#00ff88]"><ShieldCheck className="h-4 w-4" /> Dados isolados por identidade</div></section>
          </aside>
        </div>
      </div>
    </main>
  );
}
