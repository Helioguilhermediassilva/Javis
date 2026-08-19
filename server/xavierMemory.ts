import { applySupabaseAdminHeaders } from "./supabaseAdmin";

export type XavierChannel = "web" | "telegram";
export type XavierRole = "user" | "assistant" | "system";

export interface XavierProfile {
  id: string;
  display_name: string | null;
  memory_enabled: boolean;
  retention_days: number;
  monthly_message_limit: number;
}

export interface XavierHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface XavierConversation {
  id: string;
  user_id: string;
  channel: XavierChannel;
  telegram_connection_id?: string | null;
  telegram_chat_id?: string | null;
  title?: string | null;
  last_message_at?: string;
}

export interface XavierMemorySummary {
  id: string;
  user_id: string;
  conversation_id: string | null;
  summary: string;
  source_message_count: number;
  pinned: boolean;
  updated_at: string;
}

export interface XavierMemoryContext {
  history: XavierHistoryItem[];
  summary: string | null;
}

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const PROFILE_TABLE = "xavier_profiles";
const CONVERSATION_TABLE = "xavier_conversations";
const MESSAGE_TABLE = "xavier_messages";
const SUMMARY_TABLE = "xavier_memory_summaries";

async function supabaseRequest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: applySupabaseAdminHeaders(init),
    signal: AbortSignal.timeout(8_000),
  });
}

async function readRows<T>(response: Response, label: string): Promise<T[]> {
  if (!response.ok) throw new Error(`Supabase ${label} ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return (await response.json().catch(() => [])) as T[];
}

function monthStart(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function getXavierProfile(userId: string): Promise<XavierProfile> {
  const params = new URLSearchParams({
    select: "id,display_name,memory_enabled,retention_days,monthly_message_limit",
    id: `eq.${userId}`,
    limit: "1",
  });
  const rows = await readRows<XavierProfile>(await supabaseRequest(`${PROFILE_TABLE}?${params}`), "profile");
  if (rows[0]) return rows[0];

  const response = await supabaseRequest(PROFILE_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ id: userId }),
  });
  const created = await readRows<XavierProfile>(response, "profile insert");
  if (!created[0]) throw new Error("Perfil Xavier não foi criado");
  return created[0];
}

export async function updateXavierProfile(userId: string, input: Partial<Pick<XavierProfile, "display_name" | "memory_enabled" | "retention_days" | "monthly_message_limit">>): Promise<XavierProfile> {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof input.display_name === "string") body.display_name = input.display_name.slice(0, 120);
  if (typeof input.memory_enabled === "boolean") body.memory_enabled = input.memory_enabled;
  if (typeof input.retention_days === "number") body.retention_days = Math.max(7, Math.min(3650, Math.round(input.retention_days)));
  if (typeof input.monthly_message_limit === "number") body.monthly_message_limit = Math.max(10, Math.min(100000, Math.round(input.monthly_message_limit)));
  const params = new URLSearchParams({ id: `eq.${userId}`, select: "id,display_name,memory_enabled,retention_days,monthly_message_limit" });
  const response = await supabaseRequest(`${PROFILE_TABLE}?${params}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const rows = await readRows<XavierProfile>(response, "profile update");
  if (!rows[0]) throw new Error("Perfil Xavier não encontrado");
  return rows[0];
}

export async function ensureXavierConversation(input: {
  userId: string;
  channel: XavierChannel;
  telegramConnectionId?: string;
  telegramChatId?: string;
  title?: string;
}): Promise<XavierConversation> {
  const params = new URLSearchParams({
    select: "id,user_id,channel,telegram_connection_id,telegram_chat_id,title,last_message_at",
    user_id: `eq.${input.userId}`,
    channel: `eq.${input.channel}`,
    order: "last_message_at.desc",
    limit: "1",
  });
  if (input.channel === "telegram") {
    if (!input.telegramConnectionId || !input.telegramChatId) throw new Error("Identidade Telegram incompleta");
    params.set("telegram_connection_id", `eq.${input.telegramConnectionId}`);
    params.set("telegram_chat_id", `eq.${input.telegramChatId}`);
  }
  const existing = await readRows<XavierConversation>(await supabaseRequest(`${CONVERSATION_TABLE}?${params}`), "conversation");
  if (existing[0]) return existing[0];

  const response = await supabaseRequest(CONVERSATION_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: input.userId,
      channel: input.channel,
      telegram_connection_id: input.telegramConnectionId || null,
      telegram_chat_id: input.telegramChatId || null,
      title: input.title?.slice(0, 160) || null,
    }),
  });
  const rows = await readRows<XavierConversation>(response, "conversation insert");
  if (!rows[0]) throw new Error("Conversa Xavier não foi criada");
  return rows[0];
}

export async function loadXavierHistory(conversationId: string, limit = 20): Promise<XavierHistoryItem[]> {
  const safeLimit = Math.max(1, Math.min(limit, 40));
  const params = new URLSearchParams({
    select: "role,content",
    conversation_id: `eq.${conversationId}`,
    role: "in.(user,assistant)",
    order: "created_at.desc",
    limit: String(safeLimit),
  });
  const rows = await readRows<Array<{ role?: string; content?: string }>[number]>(await supabaseRequest(`${MESSAGE_TABLE}?${params}`), "history");
  return rows
    .filter((row) => (row.role === "user" || row.role === "assistant") && typeof row.content === "string")
    .reverse()
    .map((row) => ({ role: row.role as "user" | "assistant", content: row.content as string }));
}

export async function loadXavierSummary(conversationId: string): Promise<XavierMemorySummary | null> {
  const params = new URLSearchParams({
    select: "id,user_id,conversation_id,summary,source_message_count,pinned,updated_at",
    conversation_id: `eq.${conversationId}`,
    order: "updated_at.desc",
    limit: "1",
  });
  const rows = await readRows<XavierMemorySummary>(await supabaseRequest(`${SUMMARY_TABLE}?${params}`), "summary");
  return rows[0] || null;
}

export async function listXavierSummaries(userId: string): Promise<XavierMemorySummary[]> {
  const params = new URLSearchParams({
    select: "id,user_id,conversation_id,summary,source_message_count,pinned,updated_at",
    user_id: `eq.${userId}`,
    order: "updated_at.desc",
    limit: "10",
  });
  return readRows<XavierMemorySummary>(await supabaseRequest(`${SUMMARY_TABLE}?${params}`), "summary");
}

export async function loadXavierMemoryContext(conversationId: string, memoryEnabled: boolean): Promise<XavierMemoryContext> {
  if (!memoryEnabled) return { history: [], summary: null };
  const [history, summary] = await Promise.all([
    loadXavierHistory(conversationId, 20),
    loadXavierSummary(conversationId),
  ]);
  return { history, summary: summary?.summary || null };
}

export function buildXavierRollingSummary(previousSummary: string | null, history: XavierHistoryItem[]): string {
  const recent = history
    .filter((item) => item.content.trim())
    .map((item) => `${item.role === "user" ? "Usuário" : "Xavier"}: ${item.content.trim().slice(0, 600)}`)
    .join("\n");
  const prefix = previousSummary?.trim()
    ? `Resumo acumulado anterior:\n${previousSummary.trim()}\n\nAtualizações recentes:\n`
    : "Resumo acumulado da conversa:\n";
  return `${prefix}${recent}`.trim().slice(-6000);
}

async function countXavierConversationMessages(conversationId: string): Promise<number> {
  const params = new URLSearchParams({
    select: "id",
    conversation_id: `eq.${conversationId}`,
    limit: "1",
  });
  const response = await supabaseRequest(`${MESSAGE_TABLE}?${params}`, {
    headers: { Prefer: "count=exact", Range: "0-0" },
  });
  if (!response.ok) throw new Error(`Supabase message count ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const range = response.headers.get("content-range") || "";
  const separator = range.lastIndexOf("/");
  const count = separator >= 0 ? Number(range.slice(separator + 1)) : 0;
  return Number.isFinite(count) ? count : 0;
}

export async function maybeCompactXavierConversation(userId: string, conversationId: string, retentionDays: number): Promise<boolean> {
  const count = await countXavierConversationMessages(conversationId);
  if (count < 20 || count % 20 !== 0) return false;
  const [history, previous] = await Promise.all([
    loadXavierHistory(conversationId, 20),
    loadXavierSummary(conversationId),
  ]);
  const summary = buildXavierRollingSummary(previous?.summary || null, history);
  const body = {
    user_id: userId,
    conversation_id: conversationId,
    summary,
    source_message_count: count,
    updated_at: new Date().toISOString(),
  };
  if (previous) {
    const params = new URLSearchParams({ id: `eq.${previous.id}` });
    const response = await supabaseRequest(`${SUMMARY_TABLE}?${params}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Supabase summary update ${response.status}: ${(await response.text()).slice(0, 300)}`);
  } else {
    const response = await supabaseRequest(SUMMARY_TABLE, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Supabase summary insert ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  await purgeExpiredXavierMessages(userId, retentionDays);
  return true;
}

export async function purgeExpiredXavierMessages(userId: string, retentionDays: number): Promise<void> {
  const days = Math.max(7, Math.min(3650, Math.round(retentionDays)));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({ user_id: `eq.${userId}`, created_at: `lt.${cutoff}` });
  const response = await supabaseRequest(`${MESSAGE_TABLE}?${params}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Supabase retention cleanup ${response.status}: ${(await response.text()).slice(0, 300)}`);
}

export async function consumeXavierMessageQuota(userId: string, monthlyLimit: number): Promise<boolean> {
  const response = await supabaseRequest("rpc/increment_xavier_usage", {
    method: "POST",
    body: JSON.stringify({ p_user_id: userId, p_month_start: monthStart(), p_limit: monthlyLimit }),
  });
  if (!response.ok) throw new Error(`Supabase usage ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return Boolean(await response.json().catch(() => false));
}

export async function appendXavierMessage(input: {
  userId: string;
  conversationId: string;
  channel: XavierChannel;
  role: XavierRole;
  content: string;
  telegramMessageId?: number;
  telegramUpdateId?: number;
}): Promise<boolean> {
  const content = input.content.trim().slice(0, 12000);
  if (!content) return true;
  const response = await supabaseRequest(MESSAGE_TABLE, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      user_id: input.userId,
      conversation_id: input.conversationId,
      channel: input.channel,
      role: input.role,
      content,
      telegram_message_id: input.telegramMessageId ?? null,
      telegram_update_id: input.telegramUpdateId ?? null,
    }),
  });
  if (response.status === 409) return false;
  if (!response.ok) throw new Error(`Supabase message ${response.status}: ${(await response.text()).slice(0, 300)}`);

  const params = new URLSearchParams({ id: `eq.${input.conversationId}` });
  await supabaseRequest(`${CONVERSATION_TABLE}?${params}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
  return true;
}

export async function deleteXavierUserData(userId: string): Promise<void> {
  for (const table of ["xavier_messages", "xavier_memory_summaries", "xavier_conversations", "xavier_telegram_connections", "xavier_usage_monthly", "xavier_profiles"]) {
    const params = new URLSearchParams({ user_id: `eq.${userId}` });
    const response = await supabaseRequest(`${table}?${params}`, { method: "DELETE" });
    if (!response.ok) throw new Error(`Supabase delete ${table} ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
}
