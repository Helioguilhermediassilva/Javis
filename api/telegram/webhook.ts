import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateJarvisReply, JarvisChatError, type ChatPayload } from "../../server/jarvisProxy.js";
import { appendTelegramMessage, loadTelegramHistory } from "../../server/telegramHistory.js";

export const config = { maxDuration: 60 };

interface TelegramChat {
  id: number;
}

interface TelegramUser {
  id: number;
  username?: string;
  is_bot?: boolean;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
}

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
}

function getHeader(req: VercelRequest, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function json(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).json(body);
}

function allowedChatIds(): Set<string> | null {
  const raw = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || "").trim();
  if (!raw) return null;
  return new Set(raw.split(",").map((value) => value.trim()).filter(Boolean));
}

function splitTelegramText(text: string, maxLength = 3900): string[] {
  const normalized = text.trim();
  if (!normalized) return ["Não consegui gerar uma resposta desta vez, senhor."];
  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf("\n", maxLength);
    if (cut < Math.floor(maxLength * 0.6)) cut = remaining.lastIndexOf(" ", maxLength);
    if (cut < Math.floor(maxLength * 0.6)) cut = maxLength;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function telegramApi(method: string, body: Record<string, unknown>): Promise<unknown> {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN não configurado");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!response.ok || payload.ok === false) {
    throw new Error(`Telegram ${method} ${response.status}: ${(payload.description || "request failed").slice(0, 200)}`);
  }
  return payload;
}

async function sendTelegramText(chatId: string, text: string): Promise<void> {
  for (const chunk of splitTelegramText(text)) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: true,
    });
  }
}

function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  return Boolean(value && typeof value === "object");
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  if (!webhookSecret) {
    json(res, 500, { error: "TELEGRAM_WEBHOOK_SECRET não configurado" });
    return;
  }
  if (getHeader(req, "x-telegram-bot-api-secret-token") !== webhookSecret) {
    json(res, 401, { error: "Unauthorized" });
    return;
  }

  const update = isTelegramUpdate(req.body) ? req.body : {};
  const message = update.message;
  const chatId = message?.chat?.id != null ? String(message.chat.id) : "";
  const text = typeof message?.text === "string" ? message.text.trim().slice(0, 4000) : "";
  const user = message?.from;

  if (!chatId || !message || user?.is_bot || !text) {
    json(res, 200, { ok: true, ignored: true });
    return;
  }

  const allowed = allowedChatIds();
  if (allowed && !allowed.has(chatId)) {
    console.warn("[telegram] chat bloqueado", chatId);
    json(res, 200, { ok: true, ignored: true });
    return;
  }

  try {
    const previousHistory = await loadTelegramHistory(chatId, 20);
    const inserted = await appendTelegramMessage({
      chatId,
      telegramUserId: user?.id,
      telegramUsername: user?.username,
      role: "user",
      content: text,
      telegramMessageId: message.message_id,
      telegramUpdateId: update.update_id,
    });
    if (!inserted) {
      json(res, 200, { ok: true, duplicate: true });
      return;
    }

    const payload: ChatPayload = {
      history: previousHistory,
      userMessage: text,
      honorific: "senhor",
    };
    const result = await generateJarvisReply(payload);
    await appendTelegramMessage({
      chatId,
      telegramUserId: user?.id,
      telegramUsername: user?.username,
      role: "assistant",
      content: result.reply,
      telegramMessageId: message.message_id,
      telegramUpdateId: undefined,
    });
    await sendTelegramText(chatId, result.reply);
    json(res, 200, { ok: true });
  } catch (error) {
    const messageText = error instanceof JarvisChatError ? error.message : (error as Error).message;
    console.error("[telegram] webhook error", { updateId: update.update_id, error: messageText });
    try {
      await sendTelegramText(chatId, "Senhor, encontrei uma falha temporária ao processar sua solicitação. Tente novamente em instantes.");
    } catch (sendError) {
      console.error("[telegram] error notification failed", (sendError as Error).message);
    }
    // Acknowledge the update to avoid Telegram retrying a request that was already persisted.
    json(res, 200, { ok: true, error: "processing_failed" });
  }
}
