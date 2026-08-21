import { useCallback, useEffect, useMemo, useState } from "react";
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
import { LanguageSelector, useLanguage } from "@/contexts/LanguageContext";
import { xavierApi } from "@/lib/xavierApi";
import { redirectToNowGoHome } from "@/lib/nowgoRedirect";

interface TelegramConnection {
  id: string;
  bot_username?: string | null;
  bot_display_name?: string | null;
  bot_chat_url?: string | null;
  status: string;
  telegram_chat_id?: string | null;
  last_verified_at?: string | null;
  locale?: string | null;
}

interface TelegramStatus {
  mode?: string;
  configured?: boolean;
  connected: boolean;
  connection?: TelegramConnection;
  link?: {
    linked_at?: string | null;
    last_seen_at?: string | null;
    locale?: string | null;
  };
  error?: string;
}

interface TelegramLinkCode {
  code: string;
  deep_link: string;
  bot_username?: string | null;
  expires_at: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function isTechnicalTelegramMessage(message: string): boolean {
  return /wrong response from the webhook|500 internal server error|webhook.*(5\d\d|failed|failure)/i.test(message);
}

function friendlyTelegramError(error: unknown, fallback: string): string {
  const message = getErrorMessage(error);
  return message && !isTechnicalTelegramMessage(message) ? message : fallback;
}

export default function TelegramConnect() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading, signOut } = useAuth();
  const { locale, t } = useLanguage();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [linkCode, setLinkCode] = useState<TelegramLinkCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const formattedDate = useMemo(() => {
    const value = status?.connection?.last_verified_at || status?.link?.linked_at;
    if (!value) return "—";
    return new Date(value).toLocaleString(locale === "pt" ? "pt-BR" : locale);
  }, [locale, status]);

  const loadStatus = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const nextStatus = await xavierApi<TelegramStatus>("/api/telegram/official-status");
      setStatus(nextStatus);
      if (nextStatus.connected) setLinkCode(null);
    } catch (error) {
      setFeedback({ type: "error", text: friendlyTelegramError(error, t("telegram.statusError")) });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (authLoading || !user) return;
    void loadStatus();
  }, [authLoading, loadStatus, user]);

  useEffect(() => {
    if (!linkCode || status?.connected) return;
    const timer = window.setInterval(() => {
      void loadStatus(true);
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [linkCode, loadStatus, status?.connected]);

  async function generateLinkCode() {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await xavierApi<TelegramLinkCode>("/api/telegram/official-link", {
        method: "POST",
        body: JSON.stringify({ locale }),
      });
      setLinkCode(result);
      setFeedback({ type: "success", text: t("telegram.connectDescription") });
      await loadStatus(true);
    } catch (error) {
      setFeedback({ type: "error", text: friendlyTelegramError(error, t("telegram.connectError")) });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm(t("telegram.unlinkConfirm"))) return;
    setBusy(true);
    setFeedback(null);
    try {
      await xavierApi("/api/telegram/official-disconnect", { method: "POST" });
      setStatus({ mode: "official", configured: status?.configured, connected: false });
      setLinkCode(null);
      setFeedback({ type: "success", text: t("telegram.unlinked") });
    } catch (error) {
      setFeedback({ type: "error", text: friendlyTelegramError(error, t("telegram.connectError")) });
    } finally {
      setBusy(false);
    }
  }

  async function copyValue(value: string) {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function logout() {
    await signOut();
    redirectToNowGoHome(locale);
  }

  const botChatUrl = status?.connection?.bot_chat_url
    || (status?.connection?.bot_username ? `https://t.me/${status.connection.bot_username}` : null);
  const activeDeepLink = linkCode?.deep_link || botChatUrl;
  const expiresAt = linkCode
    ? new Date(linkCode.expires_at).toLocaleTimeString(locale === "pt" ? "pt-BR" : locale, { hour: "2-digit", minute: "2-digit" })
    : null;

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
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSelector compact />
            <Link href="/" className="flex items-center gap-2 border border-[#0d3347] px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-[#5ab8cc] transition hover:border-[#00d4ff] hover:text-[#d8f8ff]"><ArrowLeft className="h-3.5 w-3.5" /> {t("common.cockpit")}</Link>
            <button type="button" onClick={() => void logout()} className="flex items-center gap-2 border border-[#0d3347] px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-[#5ab8cc] transition hover:border-[#ff3355] hover:text-[#ff9aac]"><LogOut className="h-3.5 w-3.5" /> {t("common.logout")}</button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="border border-[#0d3347] bg-[#010d14] p-6 shadow-[0_0_40px_rgba(0,212,255,.06)] sm:p-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] tracking-[0.22em] text-[#ff6b00]">{t("telegram.eyebrow")}</p>
                <h1 className="mt-2 text-2xl font-semibold text-[#d8f8ff]">{t("telegram.title")}</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#5ab8cc]">{t("telegram.description")}</p>
              </div>
              <MessageCircle className="hidden h-10 w-10 text-[#00d4ff]/60 sm:block" />
            </div>

            {feedback && <div className={`mb-6 flex gap-3 border p-4 text-xs leading-5 ${feedback.type === "error" ? "border-[#ff3355]/50 bg-[#ff3355]/10 text-[#ff9aac]" : "border-[#00ff88]/40 bg-[#00ff88]/10 text-[#8dffc2]"}`}>{feedback.type === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}{feedback.text}</div>}

            {loading ? (
              <div className="flex items-center gap-3 border border-[#0d3347] p-5 text-xs text-[#5ab8cc]"><Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}</div>
            ) : status?.connected ? (
              <div className="border border-[#00ff88]/40 bg-[#00ff88]/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#8dffc2]"><CheckCircle2 className="h-4 w-4" /> {t("common.connected")}</div>
                    <div className="mt-2 text-lg text-[#d8f8ff]">@{status.connection?.bot_username || status.connection?.bot_display_name || "Xavier"}</div>
                    <div className="mt-1 text-xs text-[#5ab8cc]">{t("telegram.linked")}</div>
                  </div>
                  <button type="button" disabled={busy} onClick={() => void disconnect()} className="flex items-center gap-2 border border-[#ff3355]/50 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[#ff9aac] transition hover:bg-[#ff3355]/10 disabled:opacity-50"><Unplug className="h-3.5 w-3.5" /> {t("telegram.unlink")}</button>
                </div>

                <div className="mt-5 grid gap-3 border-t border-[#00ff88]/20 pt-4 text-[10px] text-[#5ab8cc] sm:grid-cols-2">
                  <div><span className="text-[#3a8a9a]">{t("telegram.chatId")}</span><div className="mt-1 break-all font-mono text-[#d8f8ff]">{status.connection?.telegram_chat_id || "—"}</div></div>
                  <div><span className="text-[#3a8a9a]">{t("telegram.lastVerification")}</span><div className="mt-1 text-[#d8f8ff]">{formattedDate}</div></div>
                </div>

                {botChatUrl && <div className="mt-5 grid gap-5 border-t border-[#00ff88]/20 pt-5 sm:grid-cols-[190px_1fr] sm:items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="bg-[#d8f8ff] p-2"><QRCodeSVG value={botChatUrl} size={170} bgColor="#d8f8ff" fgColor="#00060a" includeMargin /></div>
                    <span className="text-center text-[9px] uppercase tracking-[0.16em] text-[#3a8a9a]">{t("telegram.scanToOpen")}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#d8f8ff]"><MessageCircle className="h-4 w-4 text-[#00d4ff]" /> {t("telegram.officialBot")}</div>
                    <p className="mt-2 text-xs leading-5 text-[#5ab8cc]">{t("telegram.webhook")}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={botChatUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-[#00d4ff] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#00060a] transition hover:bg-[#8ffcff]"><ExternalLink className="h-3.5 w-3.5" /> {t("telegram.openBot")}</a>
                      <button type="button" onClick={() => void copyValue(botChatUrl)} className="flex items-center gap-2 border border-[#0d3347] px-3 py-2 text-[10px] uppercase tracking-[0.13em] text-[#5ab8cc] transition hover:border-[#00d4ff] hover:text-[#d8f8ff]"><Copy className="h-3.5 w-3.5" /> {copied ? t("common.copied") : t("common.copy")}</button>
                    </div>
                    <div className="mt-3 break-all font-mono text-[10px] text-[#3a8a9a]">{botChatUrl}</div>
                  </div>
                </div>}
              </div>
            ) : linkCode && activeDeepLink ? (
              <div className="border border-[#00d4ff]/50 bg-[#00d4ff]/5 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#d8f8ff]"><ShieldCheck className="h-4 w-4 text-[#00ff88]" /> {t("telegram.connectTitle")}</div>
                <p className="mt-2 text-xs leading-5 text-[#5ab8cc]">{t("telegram.connectDescription")}</p>
                <div className="mt-5 grid gap-5 sm:grid-cols-[190px_1fr] sm:items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="bg-[#d8f8ff] p-2"><QRCodeSVG value={activeDeepLink} size={170} bgColor="#d8f8ff" fgColor="#00060a" includeMargin /></div>
                    <span className="text-center text-[9px] uppercase tracking-[0.16em] text-[#3a8a9a]">{t("telegram.scanToOpen")}</span>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[#3a8a9a]">{t("telegram.copyCode")}</div>
                    <div className="mt-2 break-all border border-[#0d3347] bg-[#00060a] px-3 py-3 font-mono text-xs text-[#d8f8ff]">{linkCode.code}</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={activeDeepLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-[#00d4ff] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#00060a] transition hover:bg-[#8ffcff]"><ExternalLink className="h-3.5 w-3.5" /> {t("telegram.openBot")}</a>
                      <button type="button" onClick={() => void copyValue(linkCode.code)} className="flex items-center gap-2 border border-[#0d3347] px-3 py-2 text-[10px] uppercase tracking-[0.13em] text-[#5ab8cc] transition hover:border-[#00d4ff] hover:text-[#d8f8ff]"><Copy className="h-3.5 w-3.5" /> {copied ? t("telegram.codeCopied") : t("telegram.copyCode")}</button>
                    </div>
                    <div className="mt-3 text-[10px] leading-5 text-[#3a8a9a]">{t("telegram.codeExpires")} {expiresAt ? `(${expiresAt})` : ""}</div>
                    <div className="mt-2 break-all font-mono text-[10px] text-[#3a8a9a]">{activeDeepLink}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="border border-[#0d3347] bg-[#00060a] p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#d8f8ff]"><ShieldCheck className="h-4 w-4 text-[#00ff88]" /> {t("telegram.connectTitle")}</div>
                  <p className="mt-2 text-sm leading-6 text-[#5ab8cc]">{t("telegram.connectDescription")}</p>
                </div>
                <button type="button" disabled={busy || status?.configured === false} onClick={() => void generateLinkCode()} className="mt-4 flex w-full items-center justify-center gap-2 bg-[#00d4ff] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#00060a] transition hover:bg-[#8ffcff] disabled:cursor-wait disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />} {busy ? t("telegram.generatingCode") : t("telegram.generateCode")}</button>
                <div className="mt-4 flex items-center gap-2 text-[10px] leading-5 text-[#3a8a9a]"><ShieldCheck className="h-4 w-4 shrink-0 text-[#00ff88]" /> {t("telegram.noToken")}</div>
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="border border-[#0d3347] bg-[#010d14] p-6"><p className="text-[10px] tracking-[0.22em] text-[#ff6b00]">{t("telegram.eyebrow")}</p><h2 className="mt-2 text-lg font-semibold text-[#d8f8ff]">{t("telegram.setupTitle")}</h2><ol className="mt-4 space-y-4 text-sm leading-6 text-[#5ab8cc]"><li><span className="mr-2 text-[#00d4ff]">01</span> {t("telegram.setupStep1")}</li><li><span className="mr-2 text-[#00d4ff]">02</span> {t("telegram.setupStep2")}</li><li><span className="mr-2 text-[#00d4ff]">03</span> {t("telegram.setupStep3")}</li></ol></section>
            <section className="border border-[#0d3347] bg-[#010d14] p-6"><p className="text-[10px] tracking-[0.22em] text-[#ff6b00]">{t("telegram.officialBot")}</p><h2 className="mt-2 text-lg font-semibold text-[#d8f8ff]">Xavier — Inteligência Soberana</h2><p className="mt-3 text-sm leading-6 text-[#5ab8cc]">{t("telegram.description")}</p><div className="mt-5 flex items-center gap-2 border-t border-[#0d3347] pt-4 text-[10px] uppercase tracking-[0.12em] text-[#00ff88]"><ShieldCheck className="h-4 w-4" /> {t("telegram.noToken")}</div></section>
            <section className="border border-[#0d3347] bg-[#010d14] p-6"><p className="text-[10px] tracking-[0.22em] text-[#ff6b00]">{t("telegram.memoryTitle")}</p><h2 className="mt-2 text-lg font-semibold text-[#d8f8ff]">{t("telegram.memoryTitle")}</h2><p className="mt-3 text-sm leading-6 text-[#5ab8cc]">{t("telegram.memoryDescription")}</p><div className="mt-5 flex items-center gap-2 border-t border-[#0d3347] pt-4 text-[10px] uppercase tracking-[0.12em] text-[#00ff88]"><ShieldCheck className="h-4 w-4" /> {t("telegram.linked")}</div></section>
          </aside>
        </div>
      </div>
    </main>
  );
}
