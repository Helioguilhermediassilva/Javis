import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { applySupabaseAdminHeaders } from "./supabaseAdmin.js";
const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const WEBHOOK_BASE_URL = (process.env.XAVIER_TELEGRAM_WEBHOOK_BASE_URL || "https://jarvisnowgo.com/api/telegram/webhook").replace(/\/+$/, "");
const LINK_TTL_MS = 10 * 60 * 1000;
interface TelegramApiResponse<T> {
  ok?: boolean;
  result?: T;
  description?: string;
}
export interface OfficialTelegramLink {
  id: string;
  user_id: string;
  telegram_chat_id: string;
  telegram_user_id?: string | null;
  telegram_username?: string | null;
  telegram_first_name?: string | null;
  telegram_last_name?: string | null;
  locale?: "pt" | "en" | "es" | null;
  status: "active" | "unlinked";
  linked_at?: string;
  last_seen_at?: string | null;
  unlinked_at?: string | null;
}
interface OfficialTelegramLinkCode {
  id: string;
  user_id: string;
  code_hash: string;
  locale: "pt" | "en" | "es";
  expires_at: string;
  consumed_at?: string | null;
}
interface TelegramBot {
  id: number;
  is_bot: boolean;
  first_name?: string;
  username?: string;
}
interface TelegramChat {
  id: number;
  type?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}
interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}
export function getOfficialTelegramBotToken(): string {
  const token = process.env.TELEGRAM_OFFICIAL_BOT_TOKEN?.trim() || "";
  if (!token) throw new Error("TELEGRAM_OFFICIAL_BOT_TOKEN não configurado para o bot oficial");
  return token;
}
function officialWebhookSecret(): string {
  const secret = process.env.TELEGRAM_OFFICIAL_WEBHOOK_SECRET?.trim() || process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "";
  if (!secret) throw new Error("TELEGRAM_OFFICIAL_WEBHOOK_SECRET não configurado para o bot oficial");
  return secret;
}
function hashCode(code: string): Buffer {
  return createHash("sha256").update(`xavier-official-telegram:${code}`).digest();
}
function hashCodeHex(code: string): string {
  return hashCode(code).toString("hex");
}
function safeEqualCode(expectedHex: string, code: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = hashCode(code);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
async function supabaseRequest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: applySupabaseAdminHeaders(init),
    signal: AbortSignal.timeout(8_000),
  });
}
async function rows<T>(response: Response, label: string): Promise<T[]> {
  if (!response.ok) throw new Error(`Supabase ${label} ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return (await response.json().catch(() => [])) as T[];
}
async function telegramApi<T>(method: string, body?: Record<string, unknown>): Promise<T> {
  const token = getOfficialTelegramBotToken();
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/${method}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12_000),
  });
  const data = (await response.json().catch(() => ({}))) as TelegramApiResponse<T>;
  if (!response.ok || !data.ok) {
    if (response.status === 404) {
      throw new Error("Token do bot oficial Telegram inválido ou bot inexistente. Configure TELEGRAM_OFFICIAL_BOT_TOKEN com o token atual do BotFather.");
    }
    throw new Error(data.description || `Telegram ${method} ${response.status}`);
  }
  return data.result as T;
}
async function telegramMultipartApi<T>(method: string, form: FormData): Promise<T> {
  const token = getOfficialTelegramBotToken();
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/${method}`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(12_000),
  });
  const data = (await response.json().catch(() => ({}))) as TelegramApiResponse<T>;
  if (!response.ok || !data.ok) {
    if (response.status === 404) {
      throw new Error("Token do bot oficial Telegram inválido ou bot inexistente. Configure TELEGRAM_OFFICIAL_BOT_TOKEN com o token atual do BotFather.");
    }
    throw new Error(data.description || `Telegram ${method} ${response.status}`);
  }
  return data.result as T;
}
function configuredOfficialBotUsername(): string | null {
  const value = (process.env.TELEGRAM_OFFICIAL_BOT_USERNAME || "").trim().replace(/^@/, "");
  return value || null;
}
function chatUrl(username?: string | null): string | null {
  return username ? `https://t.me/${username}` : null;
}
export function isOfficialTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_OFFICIAL_BOT_TOKEN?.trim() && (process.env.TELEGRAM_OFFICIAL_WEBHOOK_SECRET?.trim() || process.env.TELEGRAM_WEBHOOK_SECRET?.trim()));
}
export async function ensureOfficialXavierTelegramWebhook(): Promise<TelegramBot> {
  const bot = await telegramApi<TelegramBot>("getMe");
  await telegramApi("setWebhook", {
    url: WEBHOOK_BASE_URL,
    secret_token: officialWebhookSecret(),
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
  await telegramApi("setMyName", { name: "Xavier" });
  await telegramApi("setMyDescription", {
    description: "Xavier — Inteligência Soberana para conversar, organizar ideias e agir com você.",
  });
  await telegramApi("setMyShortDescription", { short_description: "Inteligência Soberana do Xavier." });
  await telegramApi("setMyCommands", {
    commands: [
      { command: "start", description: "Iniciar ou vincular sua conta Xavier" },
      { command: "help", description: "Ver como usar o Xavier" },
      { command: "language", description: "Alterar idioma" },
      { command: "disconnect", description: "Desvincular este chat" },
    ],
  });
  return bot;
}
export async function createOfficialTelegramLinkCode(userId: string, locale: "pt" | "en" | "es" = "pt"): Promise<{ code: string; deep_link: string; bot_username: string | null; expires_at: string }> {
  const bot = await ensureOfficialXavierTelegramWebhook();
  await supabaseRequest(`xavier_telegram_link_codes?user_id=eq.${encodeURIComponent(userId)}&consumed_at=is.null`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ consumed_at: new Date().toISOString() }),
  });
  const code = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString();
  const response = await supabaseRequest("xavier_telegram_link_codes", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, code_hash: hashCodeHex(code), locale, expires_at: expiresAt }),
  });
  await rows<OfficialTelegramLinkCode>(response, "official telegram link code insert");
  return {
    code,
    deep_link: `https://t.me/${bot.username || ""}?start=${encodeURIComponent(code)}`,
    bot_username: bot.username || null,
    expires_at: expiresAt,
  };
}
export async function getOfficialTelegramLinkForUser(userId: string): Promise<OfficialTelegramLink | null> {
  const params = new URLSearchParams({
    select: "id,user_id,telegram_chat_id,telegram_user_id,telegram_username,telegram_first_name,telegram_last_name,locale,status,linked_at,last_seen_at,unlinked_at",
    user_id: `eq.${userId}`,
    status: "eq.active",
    limit: "1",
  });
  const result = await rows<OfficialTelegramLink>(await supabaseRequest(`xavier_telegram_official_links?${params}`), "official telegram user link");
  return result[0] || null;
}
export async function getOfficialTelegramLinkByChat(chatId: string): Promise<OfficialTelegramLink | null> {
  const params = new URLSearchParams({
    select: "id,user_id,telegram_chat_id,telegram_user_id,telegram_username,telegram_first_name,telegram_last_name,locale,status,linked_at,last_seen_at,unlinked_at",
    telegram_chat_id: `eq.${chatId}`,
    status: "eq.active",
    limit: "1",
  });
  const result = await rows<OfficialTelegramLink>(await supabaseRequest(`xavier_telegram_official_links?${params}`), "official telegram chat link");
  return result[0] || null;
}
export async function consumeOfficialTelegramLinkCode(code: string, chat: TelegramChat, from?: TelegramUser): Promise<OfficialTelegramLink> {
  const cleanCode = code.trim();
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(cleanCode)) throw new Error("Código de vinculação inválido ou expirado.");
  const params = new URLSearchParams({
    select: "id,user_id,code_hash,locale,expires_at,consumed_at",
    code_hash: `eq.${hashCodeHex(cleanCode)}`,
    consumed_at: "is.null",
    expires_at: `gt.${new Date().toISOString()}`,
    limit: "1",
  });
  const codeRows = await rows<OfficialTelegramLinkCode>(await supabaseRequest(`xavier_telegram_link_codes?${params}`), "official telegram link code lookup");
  const linkCode = codeRows[0];
  if (!linkCode || !safeEqualCode(linkCode.code_hash, cleanCode)) throw new Error("Código de vinculação inválido ou expirado.");
  const existingChatLink = await getOfficialTelegramLinkByChat(String(chat.id));
  if (existingChatLink && existingChatLink.user_id !== linkCode.user_id) {
    throw new Error("Este chat Telegram já está vinculado a outra conta Xavier.");
  }
  const existingUserLink = await getOfficialTelegramLinkForUser(linkCode.user_id);
  if (existingUserLink && existingUserLink.telegram_chat_id !== String(chat.id)) {
    await supabaseRequest(`xavier_telegram_official_links?id=eq.${encodeURIComponent(existingUserLink.id)}&user_id=eq.${encodeURIComponent(linkCode.user_id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "unlinked", unlinked_at: new Date().toISOString() }),
    });
  }
  const now = new Date().toISOString();
  const payload = {
    user_id: linkCode.user_id,
    telegram_chat_id: String(chat.id),
    telegram_user_id: from?.id != null ? String(from.id) : null,
    telegram_username: from?.username || chat.username || null,
    telegram_first_name: from?.first_name || chat.first_name || null,
    telegram_last_name: from?.last_name || chat.last_name || null,
    locale: linkCode.locale,
    status: "active",
    linked_at: now,
    last_seen_at: now,
    unlinked_at: null,
  };
  let link: OfficialTelegramLink;
  if (existingChatLink) {
    const response = await supabaseRequest(`xavier_telegram_official_links?id=eq.${encodeURIComponent(existingChatLink.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    link = (await rows<OfficialTelegramLink>(response, "official telegram link update"))[0];
  } else {
    const response = await supabaseRequest("xavier_telegram_official_links", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    link = (await rows<OfficialTelegramLink>(response, "official telegram link insert"))[0];
  }
  if (!link) throw new Error("Não foi possível concluir a vinculação do Telegram.");
  const consumedResponse = await supabaseRequest(`xavier_telegram_link_codes?id=eq.${encodeURIComponent(linkCode.id)}&consumed_at=is.null`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ consumed_at: now }),
  });
  if (!consumedResponse.ok) throw new Error("Não foi possível consumir o código de vinculação.");
  return link;
}
export async function touchOfficialTelegramLink(chatId: string): Promise<void> {
  await supabaseRequest(`xavier_telegram_official_links?telegram_chat_id=eq.${encodeURIComponent(chatId)}&status=eq.active`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
  });
}
export async function updateOfficialTelegramLocale(chatId: string, locale: "pt" | "en" | "es"): Promise<void> {
  const response = await supabaseRequest(`xavier_telegram_official_links?telegram_chat_id=eq.${encodeURIComponent(chatId)}&status=eq.active`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ locale, last_seen_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`Supabase official Telegram locale ${response.status}`);
}
export async function unlinkOfficialTelegram(userId: string): Promise<void> {
  const response = await supabaseRequest(`xavier_telegram_official_links?user_id=eq.${encodeURIComponent(userId)}&status=eq.active`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "unlinked", unlinked_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`Supabase official Telegram unlink ${response.status}`);
}
export async function getOfficialTelegramStatus(userId: string): Promise<Record<string, unknown>> {
  if (!isOfficialTelegramConfigured()) return { mode: "official", configured: false, connected: false };
  const link = await getOfficialTelegramLinkForUser(userId);
  // O status da sessão não deve depender de uma chamada externa ao Telegram.
  // A API pode estar momentaneamente indisponível mesmo com o vínculo persistido.
  const botUsername = configuredOfficialBotUsername();
  return {
    mode: "official",
    configured: true,
    connected: Boolean(link),
    connection: link ? {
      id: link.id,
      bot_username: botUsername,
      bot_display_name: "Xavier",
      bot_chat_url: chatUrl(botUsername),
      status: "active",
      last_verified_at: link.last_seen_at || link.linked_at || null,
      locale: link.locale || "pt",
    } : undefined,
    link: link ? { linked_at: link.linked_at, last_seen_at: link.last_seen_at, locale: link.locale || "pt" } : undefined,
  };
}
export function verifyOfficialTelegramWebhookSecret(presentedSecret: string): boolean {
  const expected = officialWebhookSecret();
  const left = Buffer.from(expected);
  const right = Buffer.from(presentedSecret || "");
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}
export async function sendOfficialTelegramTyping(chatId: string): Promise<void> {
  await telegramApi("sendChatAction", { chat_id: chatId, action: "typing" });
}
export async function sendOfficialTelegramMessage(chatId: string, text: string): Promise<void> {
  await telegramApi("sendMessage", { chat_id: chatId, text: text.slice(0, 4096), disable_web_page_preview: true });
}
export async function sendOfficialTelegramDocument(chatId: string, documentUrl: string, caption?: string, fileName = "xavier-arquivo.bin"): Promise<void> {
  const parsed = new URL(documentUrl);
  if (parsed.protocol !== "https:") throw new Error("Arquivo Telegram precisa usar URL HTTPS");
  try {
    await telegramApi("sendDocument", { chat_id: chatId, document: parsed.toString(), caption: caption?.slice(0, 1024) });
  } catch {
    const artifact = await fetch(parsed, { signal: AbortSignal.timeout(12_000) });
    if (!artifact.ok) throw new Error(`Download do arquivo gerado falhou (${artifact.status})`);
    const form = new FormData();
    form.set("chat_id", chatId);
    if (caption) form.set("caption", caption.slice(0, 1024));
    form.set("document", new Blob([await artifact.arrayBuffer()], { type: artifact.headers.get("content-type") || "application/octet-stream" }), fileName.slice(0, 120));
    await telegramMultipartApi("sendDocument", form);
  }
}
