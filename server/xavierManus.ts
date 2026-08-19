import { createHash, createVerify } from "node:crypto";
import {
  applySupabaseAdminHeaders,
} from "./supabaseAdmin.js";

const MANUS_API_BASE = (process.env.MANUS_API_BASE || "https://api.manus.ai").replace(/\/+$/, "");
const MANUS_WEBHOOK_KEY_URL = "https://api.manus.ai/v2/webhook.publicKey";
const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const TASK_TABLE = "xavier_manus_tasks";

export type XavierManusChannel = "web" | "telegram";
export type XavierManusTaskStatus = "running" | "completed" | "failed" | "stopped";

export interface XavierManusAttachment {
  file_name: string;
  url: string;
  size_bytes?: number;
}

export interface XavierManusTask {
  id: string;
  user_id: string;
  channel: XavierManusChannel;
  conversation_id: string | null;
  telegram_connection_id: string | null;
  telegram_chat_id: string | null;
  manus_task_id: string;
  task_url: string | null;
  status: XavierManusTaskStatus;
  request_text: string;
  result_text: string | null;
  attachments: XavierManusAttachment[];
  error_message: string | null;
  stop_reason: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  delivered_at: string | null;
}

interface ManusApiResponse {
  ok?: boolean;
  task_id?: string;
  task_title?: string;
  task_url?: string;
  request_id?: string;
  [key: string]: unknown;
}

interface ManusTaskCreationOptions {
  title?: string;
}

export interface XavierManusTaskContext {
  userId: string;
  channel: XavierManusChannel;
  conversationId?: string | null;
  telegramConnectionId?: string | null;
  telegramChatId?: string | null;
}

export interface XavierManusWebhookEvent {
  event_id?: string;
  event_type?: string;
  task_detail?: {
    task_id?: string;
    task_title?: string;
    task_url?: string;
    message?: string;
    stop_reason?: string;
    attachments?: Array<{ file_name?: string; url?: string; size_bytes?: number }>;
  };
}

export class ManusIntegrationError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ManusIntegrationError";
  }
}

function getManusApiKey(): string {
  const key = process.env.MANUS_API_KEY || "";
  if (!key) throw new ManusIntegrationError(503, "Integração Manus não configurada no servidor");
  if (!/^[\\x20-\\x7E]+$/.test(key) || /placeholder|replace\s*me|sua\s*chave/i.test(key)) {
    throw new ManusIntegrationError(503, "MANUS_API_KEY inválida: configure uma chave privada real no Vercel");
  }
  return key;
}

async function manusRequest(path: string, init: RequestInit = {}): Promise<ManusApiResponse> {
  const headers = new Headers(init.headers);
  headers.set("x-manus-api-key", getManusApiKey());
  headers.set("Accept", "application/json");
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(`${MANUS_API_BASE}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let data: ManusApiResponse = {};
  try {
    data = text ? JSON.parse(text) as ManusApiResponse : {};
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  if (!response.ok) {
    const detail = typeof data.error === "string" ? data.error : text.slice(0, 300);
    throw new ManusIntegrationError(response.status, `Manus ${response.status}: ${detail || "erro desconhecido"}`);
  }
  return data;
}

function supabaseHeaders(init: RequestInit = {}): Headers {
  return applySupabaseAdminHeaders(init);
}

async function supabaseRequest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: supabaseHeaders(init),
    signal: AbortSignal.timeout(8_000),
  });
}

async function readRows<T>(response: Response, label: string): Promise<T[]> {
  if (!response.ok) throw new Error(`Supabase ${label} ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return (await response.json().catch(() => [])) as T[];
}

function safeText(value: unknown, max = 12_000): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function safeHttpsUrl(value: unknown): string | null {
  const text = safeText(value, 2_000);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeAttachments(value: unknown): XavierManusAttachment[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: XavierManusAttachment[] = [];
  for (const item of value.slice(0, 8)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const url = safeHttpsUrl(record.url);
    if (!url || seen.has(url)) continue;
    const fileName = safeText(record.file_name, 180) || "arquivo-gerado";
    const size = typeof record.size_bytes === "number" && Number.isFinite(record.size_bytes) && record.size_bytes >= 0
      ? Math.floor(record.size_bytes)
      : undefined;
    normalized.push(size === undefined ? { file_name: fileName, url } : { file_name: fileName, url, size_bytes: size });
    seen.add(url);
  }
  return normalized;
}

const TASK_SELECT = "id,user_id,channel,conversation_id,telegram_connection_id,telegram_chat_id,manus_task_id,task_url,status,request_text,result_text,attachments,error_message,stop_reason,created_at,updated_at,completed_at,delivered_at";

export function isManusConfigured(): boolean {
  return Boolean(process.env.MANUS_API_KEY);
}

export function routeManusTaskRequest(message: string, engine: "auto" | "grok" | "manus" = "auto"): { requestText: string; title: string } | null {
  if (engine === "grok") return null;
  const detected = detectManusTaskRequest(message);
  if (!detected) return null;
  const explicit = /^\s*\/(?:manus|profundo|deep)\b/i.test(message) || engine === "manus";
  return explicit || isManusConfigured() ? detected : null;
}

export function detectManusTaskRequest(message: string): { requestText: string; title: string } | null {
  const raw = message.trim();
  if (!raw) return null;
  const explicit = raw.match(/^\s*\/(?:manus|profundo|deep)\s*[:\-]?\s*([\s\S]+)$/i);
  if (explicit?.[1]?.trim()) {
    return { requestText: explicit[1].trim().slice(0, 12_000), title: "Tarefa profunda do Xavier" };
  }
  if (/\b(?:use|usar|utilize|acion[ae]|chame|chamar)\s+(?:a\s+)?(?:manus|sun)\b/i.test(raw)) {
    return { requestText: raw, title: "Tarefa Manus solicitada pelo Xavier" };
  }
  if (/\b(?:pesquisa|pesquise|investigue|investigar|relat[óo]rio|documento|autom[aá]?[çc][aã]o|an[aá]lise profunda|tarefa profunda)\b/i.test(raw)
    || /\b(?:ger[ae]r?|crie?|produz[ae]r?|prepare?|elabore?)\b[\s\S]{0,80}\b(?:pdf|documento|arquivo|relat[óo]rio)\b/i.test(raw)
    || /\b(?:pdf|documento|arquivo)\b[\s\S]{0,40}\b(?:baixar|download|anex[ae]r?|envie?|enviar)\b/i.test(raw)) {
    return { requestText: raw, title: /\bpdf\b/i.test(raw) ? "Geração de PDF do Xavier" : "Execução profunda do Xavier" };
  }
  return null;
}

export async function createManusTask(input: XavierManusTaskContext, requestText: string, options: ManusTaskCreationOptions = {}): Promise<XavierManusTask> {
  const normalized = requestText.trim().slice(0, 12_000);
  if (!normalized) throw new ManusIntegrationError(400, "A tarefa Manus não pode estar vazia");
  const pdfRequested = /\bpdf\b/i.test(normalized);
  const manusPrompt = pdfRequested
    ? `${normalized}\n\nInstrução adicional: gere o resultado como um arquivo PDF real, anexe o PDF ao concluir e informe brevemente o que foi produzido. Não responda apenas que não pode gerar arquivos.`
    : normalized;
  const body: Record<string, unknown> = {
    message: { content: manusPrompt.slice(0, 12_000) },
    locale: "pt-BR",
    interactive_mode: false,
    title: (options.title || "Tarefa profunda do Xavier").slice(0, 160),
  };
  if (process.env.MANUS_PROJECT_ID) body.project_id = process.env.MANUS_PROJECT_ID;
  if (process.env.MANUS_AGENT_PROFILE) body.agent_profile = process.env.MANUS_AGENT_PROFILE;
  const created = await manusRequest("/v2/task.create", { method: "POST", body: JSON.stringify(body) });
  const manusTaskId = safeText(created.task_id, 200);
  if (!manusTaskId) throw new ManusIntegrationError(502, "Manus não retornou task_id");

  const insert = await supabaseRequest(TASK_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: input.userId,
      channel: input.channel,
      conversation_id: input.conversationId || null,
      telegram_connection_id: input.telegramConnectionId || null,
      telegram_chat_id: input.telegramChatId || null,
      manus_task_id: manusTaskId,
      task_url: safeText(created.task_url, 500),
      status: "running",
      request_text: normalized,
      attachments: [],
    }),
  });
  const rows = await readRows<XavierManusTask>(insert, "Manus task insert");
  if (!rows[0]) throw new Error("Tarefa Manus não foi persistida");
  return rows[0];
}

export async function sendManusTaskMessage(taskId: string, message: string): Promise<void> {
  const normalizedTaskId = taskId.trim().slice(0, 200);
  const normalizedMessage = message.trim().slice(0, 12_000);
  if (!normalizedTaskId || !normalizedMessage) throw new ManusIntegrationError(400, "task_id e message são obrigatórios");
  await manusRequest("/v2/task.sendMessage", {
    method: "POST",
    body: JSON.stringify({ task_id: normalizedTaskId, message: { content: normalizedMessage } }),
  });
}

export async function listXavierManusTasks(userId: string, limit = 20): Promise<XavierManusTask[]> {
  const params = new URLSearchParams({
    select: TASK_SELECT,
    user_id: `eq.${userId}`,
    order: "created_at.desc",
    limit: String(Math.max(1, Math.min(limit, 50))),
  });
  return readRows<XavierManusTask>(await supabaseRequest(`${TASK_TABLE}?${params}`), "Manus task list");
}

export async function getXavierManusTask(userId: string, taskId: string): Promise<XavierManusTask | null> {
  const params = new URLSearchParams({
    select: TASK_SELECT,
    user_id: `eq.${userId}`,
    id: `eq.${taskId}`,
    limit: "1",
  });
  const rows = await readRows<XavierManusTask>(await supabaseRequest(`${TASK_TABLE}?${params}`), "Manus task");
  return rows[0] || null;
}

export async function markManusTaskDelivered(userId: string, taskId: string): Promise<void> {
  const params = new URLSearchParams({ user_id: `eq.${userId}`, id: `eq.${taskId}` });
  const response = await supabaseRequest(`${TASK_TABLE}?${params}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`Supabase Manus task delivery ${response.status}: ${(await response.text()).slice(0, 300)}`);
}

async function findTaskByManusId(manusTaskId: string): Promise<XavierManusTask | null> {
  const params = new URLSearchParams({
    select: TASK_SELECT,
    manus_task_id: `eq.${manusTaskId}`,
    limit: "1",
  });
  const rows = await readRows<XavierManusTask>(await supabaseRequest(`${TASK_TABLE}?${params}`), "Manus task lookup");
  return rows[0] || null;
}

export async function applyManusWebhookEvent(event: XavierManusWebhookEvent): Promise<XavierManusTask | null> {
  const detail = event.task_detail;
  const manusTaskId = safeText(detail?.task_id, 200);
  if (!manusTaskId) return null;
  const existing = await findTaskByManusId(manusTaskId);
  if (!existing) return null;

  const eventType = safeText(event.event_type, 80);
  const now = new Date().toISOString();
  const result = safeText(detail?.message, 12_000);
  const attachments = normalizeAttachments(detail?.attachments);
  const stopReason = safeText(detail?.stop_reason, 80);
  const patch: Record<string, unknown> = { updated_at: now };
  if (safeText(detail?.task_url, 500)) patch.task_url = safeText(detail?.task_url, 500);
  if (eventType === "task_created") {
    patch.status = "running";
  } else if (eventType === "task_stopped") {
    patch.status = stopReason === "finish" ? "completed" : "stopped";
    patch.result_text = result;
    patch.attachments = attachments;
    patch.stop_reason = stopReason;
    patch.completed_at = now;
  }
  const params = new URLSearchParams({ id: `eq.${existing.id}`, manus_task_id: `eq.${manusTaskId}` });
  const response = await supabaseRequest(`${TASK_TABLE}?${params}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  const rows = await readRows<XavierManusTask>(response, "Manus task webhook update");
  return rows[0] || existing;
}

let cachedPublicKey: string | null = null;
let cachedPublicKeyAt = 0;

async function getManusWebhookPublicKey(): Promise<string> {
  if (cachedPublicKey && Date.now() - cachedPublicKeyAt < 10 * 60_000) return cachedPublicKey;
  const response = await fetch(MANUS_WEBHOOK_KEY_URL, {
    headers: { "x-manus-api-key": getManusApiKey(), Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  if (!response.ok) throw new ManusIntegrationError(response.status, `Manus public key ${response.status}: ${text.slice(0, 300)}`);
  const parsed = JSON.parse(text) as { public_key?: string; key?: string };
  const key = parsed.public_key || parsed.key;
  if (!key) throw new ManusIntegrationError(502, "Manus não retornou a chave pública do webhook");
  cachedPublicKey = key;
  cachedPublicKeyAt = Date.now();
  return key;
}

export async function verifyManusWebhookSignature(rawBody: string, signature: string, timestamp: string, webhookUrl: string): Promise<boolean> {
  if (!signature || !timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts * 1000) > 5 * 60_000) return false;
  const publicKey = await getManusWebhookPublicKey();
  const verifier = createVerify("RSA-SHA256");
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  verifier.update(`${timestamp}.${webhookUrl}.${bodyHash}`);
  verifier.end();
  try {
    return verifier.verify(publicKey, signature, "base64");
  } catch {
    return false;
  }
}

export function buildManusAcknowledgement(task: XavierManusTask): string {
  const taskLink = task.task_url ? `\nAcompanhe o andamento: ${task.task_url}` : "";
  return `Entendido, senhor. Encaminhei esta solicitação para a camada Manus/SUN de execução profunda. Avisarei assim que o resultado estiver pronto.${taskLink}`.slice(0, 1800);
}

export function buildManusResultText(task: XavierManusTask): string {
  const header = task.status === "completed"
    ? "Concluí a tarefa profunda com a Manus/SUN."
    : "A tarefa profunda da Manus/SUN foi interrompida antes da conclusão.";
  const body = task.result_text?.trim() || task.error_message?.trim() || "Não recebi um resultado textual da tarefa.";
  const taskUrl = task.task_url ? `\n\nAcompanhe na Manus: ${task.task_url}` : "";
  const attachments = (task.attachments || []).slice(0, 8).map((file) => `\n• ${file.file_name}: ${file.url}`).join("");
  return `${header}\n\n${body}${attachments ? `\n\nArquivos gerados:${attachments}` : ""}${taskUrl}`.slice(0, 12_000);
}
