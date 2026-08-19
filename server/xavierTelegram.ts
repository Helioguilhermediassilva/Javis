import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { applySupabaseAdminHeaders } from "./supabaseAdmin.js";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const WEBHOOK_BASE_URL = (process.env.XAVIER_TELEGRAM_WEBHOOK_BASE_URL || "https://jarvisnowgo.com/api/telegram/webhook").replace(/\/+$/, "");

export interface XavierTelegramConnection {
  id: string;
  user_id: string;
  bot_id: number;
  bot_username?: string | null;
  bot_display_name?: string | null;
  bot_chat_url?: string | null;
  status: "active" | "disconnected" | "error";
  last_error?: string | null;
  last_verified_at?: string | null;
  created_at?: string;
}

interface StoredConnection extends XavierTelegramConnection {
  encrypted_bot_token: string;
  webhook_secret_hash: string;
}

interface TelegramApiResponse<T> {
  ok?: boolean;
  result?: T;
  description?: string;
}

interface TelegramBot {
  id: number;
  is_bot: boolean;
  first_name?: string;
  username?: string;
}

function getEncryptionKey(): Buffer {
  const secret = process.env.XAVIER_ENCRYPTION_KEY || "";
  if (!secret) throw new Error("XAVIER_ENCRYPTION_KEY não configurada");
  return createHash("sha256").update(secret).digest();
}

function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptToken(value: string): string {
  const [ivEncoded, tagEncoded, payloadEncoded] = value.split(".");
  if (!ivEncoded || !tagEncoded || !payloadEncoded) throw new Error("Token Telegram cifrado inválido");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(payloadEncoded, "base64url")), decipher.final()]).toString("utf8");
}

function hashWebhookSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
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

async function telegramApi<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/${method}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12_000),
  });
  const data = (await response.json().catch(() => ({}))) as TelegramApiResponse<T>;
  if (!response.ok || !data.ok) throw new Error(data.description || `Telegram ${method} ${response.status}`);
  return data.result as T;
}

function getTelegramBotChatUrl(username?: string | null): string | null {
  return username ? `https://t.me/${username}` : null;
}

async function configureXavierBotProfile(token: string): Promise<void> {
  await telegramApi(token, "setMyName", { name: "Xavier" });
  await telegramApi(token, "setMyDescription", {
    description: "Xavier — Inteligência Soberana para conversar, organizar ideias e agir com você.",
  });
  await telegramApi(token, "setMyShortDescription", {
    short_description: "Inteligência Soberana do Xavier.",
  });
  await telegramApi(token, "setMyCommands", {
    commands: [
      { command: "start", description: "Iniciar conversa com Xavier" },
      { command: "help", description: "Ver como usar o Xavier" },
      { command: "settings", description: "Ver configurações da conta" },
    ],
  });
}

export async function getActiveXavierTelegramConnection(userId: string): Promise<XavierTelegramConnection | null> {
  const params = new URLSearchParams({
    select: "id,user_id,bot_id,bot_username,bot_display_name,status,last_error,last_verified_at,created_at",
    user_id: `eq.${userId}`,
    status: "eq.active",
    order: "created_at.desc",
    limit: "1",
  });
  const result = await rows<XavierTelegramConnection>(await supabaseRequest(`xavier_telegram_connections?${params}`), "telegram connection");
  return result[0] || null;
}

export async function getStoredXavierTelegramConnection(connectionId: string): Promise<StoredConnection | null> {
  const params = new URLSearchParams({
    select: "id,user_id,bot_id,bot_username,bot_display_name,status,last_error,last_verified_at,created_at,encrypted_bot_token,webhook_secret_hash",
    id: `eq.${connectionId}`,
    limit: "1",
  });
  const result = await rows<StoredConnection>(await supabaseRequest(`xavier_telegram_connections?${params}`), "telegram webhook connection");
  return result[0] || null;
}

export async function connectXavierTelegram(userId: string, rawToken: string): Promise<XavierTelegramConnection> {
  const token = rawToken.trim();
  if (token.length < 20 || token.length > 200 || !/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error("Token Telegram inválido. Use o token fornecido pelo @BotFather.");
  }
  const bot = await telegramApi<TelegramBot>(token, "getMe");
  await configureXavierBotProfile(token);
  const connectionId = randomUUID();
  const webhookSecret = randomBytes(32).toString("base64url");
  const insertResponse = await supabaseRequest("xavier_telegram_connections", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: connectionId,
      user_id: userId,
      bot_id: bot.id,
      bot_username: bot.username || null,
      bot_display_name: "Xavier",
      encrypted_bot_token: encryptToken(token),
      webhook_secret_hash: hashWebhookSecret(webhookSecret),
      status: "active",
      last_error: null,
    }),
  });
  const inserted = await rows<StoredConnection>(insertResponse, "telegram connection insert");
  if (!inserted[0]) throw new Error("Não foi possível registrar a conexão Telegram");

  try {
    await telegramApi(token, "setWebhook", {
      url: `${WEBHOOK_BASE_URL}?connection_id=${encodeURIComponent(connectionId)}`,
      secret_token: webhookSecret,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    });
    const verifyResponse = await supabaseRequest(`xavier_telegram_connections?id=eq.${connectionId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    });
    if (!verifyResponse.ok) throw new Error(`Supabase connection verify ${verifyResponse.status}`);
  } catch (error) {
    await supabaseRequest(`xavier_telegram_connections?id=eq.${connectionId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "error", last_error: (error as Error).message.slice(0, 500), updated_at: new Date().toISOString() }),
    });
    throw error;
  }

  return {
    id: inserted[0].id,
    user_id: inserted[0].user_id,
    bot_id: inserted[0].bot_id,
    bot_username: inserted[0].bot_username,
    bot_display_name: inserted[0].bot_display_name,
    bot_chat_url: getTelegramBotChatUrl(inserted[0].bot_username),
    status: "active",
    last_verified_at: new Date().toISOString(),
    created_at: inserted[0].created_at,
  };
}

export async function getXavierTelegramStatus(userId: string): Promise<Record<string, unknown>> {
  const connection = await getActiveXavierTelegramConnection(userId);
  if (!connection) return { connected: false };
  const stored = await getStoredXavierTelegramConnection(connection.id);
  if (!stored) return { connected: false };
  try {
    const webhook = await telegramApi<Record<string, unknown>>(decryptToken(stored.encrypted_bot_token), "getWebhookInfo");
    return { connected: true, connection: { ...connection, bot_chat_url: getTelegramBotChatUrl(connection.bot_username) }, webhook };
  } catch (error) {
    return { connected: true, connection: { ...connection, bot_chat_url: getTelegramBotChatUrl(connection.bot_username) }, webhook: null, error: (error as Error).message };
  }
}

export async function disconnectXavierTelegram(userId: string): Promise<void> {
  const connection = await getActiveXavierTelegramConnection(userId);
  if (!connection) return;
  const stored = await getStoredXavierTelegramConnection(connection.id);
  if (stored) {
    try { await telegramApi(decryptToken(stored.encrypted_bot_token), "deleteWebhook", { drop_pending_updates: false }); } catch { /* estado local ainda será encerrado */ }
  }
  const response = await supabaseRequest(`xavier_telegram_connections?id=eq.${connection.id}&user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "disconnected", updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`Supabase disconnect ${response.status}: ${(await response.text()).slice(0, 300)}`);
}

export function verifyXavierTelegramWebhookSecret(connection: StoredConnection, presentedSecret: string): boolean {
  if (!presentedSecret || !connection.webhook_secret_hash) return false;
  const expected = Buffer.from(connection.webhook_secret_hash, "hex");
  const actual = Buffer.from(hashWebhookSecret(presentedSecret), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function decryptXavierTelegramToken(connection: StoredConnection): string {
  return decryptToken(connection.encrypted_bot_token);
}

export async function sendXavierTelegramTyping(connection: StoredConnection, chatId: string): Promise<void> {
  await telegramApi(decryptToken(connection.encrypted_bot_token), "sendChatAction", {
    chat_id: chatId,
    action: "typing",
  });
}

export async function sendXavierTelegramMessage(connection: StoredConnection, chatId: string, text: string): Promise<void> {
  await telegramApi(decryptToken(connection.encrypted_bot_token), "sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4096),
    disable_web_page_preview: true,
  });
}

export async function sendXavierTelegramDocument(
  connection: StoredConnection,
  chatId: string,
  documentUrl: string,
  caption?: string,
): Promise<void> {
  const parsed = new URL(documentUrl);
  if (parsed.protocol !== "https:") throw new Error("Arquivo Telegram precisa usar URL HTTPS");
  await telegramApi(decryptToken(connection.encrypted_bot_token), "sendDocument", {
    chat_id: chatId,
    document: parsed.toString(),
    caption: caption?.slice(0, 1024),
  });
}
