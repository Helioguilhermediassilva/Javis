export interface TelegramHistoryItem {
  role: "user" | "assistant";
  content: string;
}

import { applySupabaseAdminHeaders } from "./supabaseAdmin";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");

const TABLE = "xavier_telegram_messages";

async function supabaseRequest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: applySupabaseAdminHeaders(init),
    signal: AbortSignal.timeout(8_000),
  });
}

export async function loadTelegramHistory(chatId: string, limit = 20): Promise<TelegramHistoryItem[]> {
  const safeLimit = Math.max(1, Math.min(limit, 40));
  const params = new URLSearchParams({
    select: "role,content",
    chat_id: `eq.${chatId}`,
    order: "created_at.desc",
    limit: String(safeLimit),
  });
  const response = await supabaseRequest(`${TABLE}?${params.toString()}`, { method: "GET" });
  if (!response.ok) throw new Error(`Supabase history ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const rows = (await response.json()) as Array<{ role?: string; content?: string }>;
  return rows
    .filter((row) => (row.role === "user" || row.role === "assistant") && typeof row.content === "string")
    .reverse()
    .map((row) => ({ role: row.role as "user" | "assistant", content: row.content as string }));
}

export async function appendTelegramMessage(input: {
  chatId: string;
  telegramUserId?: number;
  telegramUsername?: string;
  role: "user" | "assistant";
  content: string;
  telegramMessageId?: number;
  telegramUpdateId?: number;
}): Promise<boolean> {
  const response = await supabaseRequest(TABLE, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      chat_id: input.chatId,
      telegram_user_id: input.telegramUserId ?? null,
      telegram_username: input.telegramUsername || null,
      role: input.role,
      content: input.content.slice(0, 12000),
      telegram_message_id: input.telegramMessageId ?? null,
      telegram_update_id: input.telegramUpdateId ?? null,
    }),
  });
  if (response.status === 409) return false;
  if (!response.ok) throw new Error(`Supabase insert ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return true;
}
