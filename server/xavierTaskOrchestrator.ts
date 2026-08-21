import { randomUUID } from "node:crypto";
import { applySupabaseAdminHeaders } from "./supabaseAdmin.js";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const ACTION_TABLE = "xavier_action_requests";
const ACTION_SELECT = "id,user_id,channel,conversation_id,telegram_connection_id,telegram_chat_id,kind,title,request_text,status,approval_code,metadata,result_text,attachments,error_message,created_at,updated_at,approved_at,completed_at";
const ACTION_EXECUTOR_URL = (process.env.XAVIER_ACTION_EXECUTOR_URL || "").trim().replace(/\/+$/, "");
const ACTION_EXECUTOR_SECRET = (process.env.XAVIER_ACTION_EXECUTOR_SECRET || "").trim();

export type XavierTaskChannel = "web" | "telegram";
export type XavierTaskKind = "document" | "pdf" | "presentation" | "image" | "video" | "system" | "mcp" | "external";
export type XavierActionStatus = "pending_approval" | "queued" | "running" | "completed" | "failed" | "cancelled";

export interface XavierActionAttachment {
  file_name: string;
  url: string;
  size_bytes?: number;
  mime_type?: string;
}

export interface XavierActionRequest {
  id: string;
  user_id: string;
  channel: XavierTaskChannel;
  conversation_id: string | null;
  telegram_connection_id: string | null;
  telegram_chat_id: string | null;
  kind: XavierTaskKind;
  title: string;
  request_text: string;
  status: XavierActionStatus;
  approval_code: string;
  metadata: Record<string, unknown>;
  result_text: string | null;
  attachments: XavierActionAttachment[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  completed_at: string | null;
}

export interface XavierActionExecutorPayload {
  status?: "completed" | "failed" | "queued" | "running";
  result_text?: string;
  error_message?: string;
  attachments?: unknown;
}

interface XavierTaskIntent {
  kind: XavierTaskKind;
  title: string;
  requiresApproval: boolean;
  execution: "local" | "provider" | "mcp" | "external";
}

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function cleanText(value: unknown, max = 12_000): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function cleanJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 30));
}

function cleanAttachments(value: unknown): XavierActionAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const fileName = cleanText(record.file_name, 180);
    const url = cleanText(record.url, 2_000);
    if (!fileName || !url || !/^https:\/\//i.test(url)) return [];
    const size = typeof record.size_bytes === "number" && Number.isFinite(record.size_bytes) ? Math.max(0, Math.floor(record.size_bytes)) : undefined;
    const mime = cleanText(record.mime_type, 120) || undefined;
    return [{ file_name: fileName, url, ...(size === undefined ? {} : { size_bytes: size }), ...(mime ? { mime_type: mime } : {}) }];
  });
}

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

function executorUrl(): string | null {
  if (!ACTION_EXECUTOR_URL || !ACTION_EXECUTOR_SECRET) return null;
  try {
    const url = new URL(ACTION_EXECUTOR_URL);
    return url.protocol === "https:" ? url.toString().replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
}

export function isXavierActionExecutorConfigured(): boolean {
  return Boolean(executorUrl());
}

async function patchAction(action: XavierActionRequest, patch: Record<string, unknown>): Promise<XavierActionRequest> {
  const params = new URLSearchParams({ id: `eq.${action.id}`, user_id: `eq.${action.user_id}` });
  const response = await supabaseRequest(`${ACTION_TABLE}?${params}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  const rows = await readRows<XavierActionRequest>(response, "action patch");
  if (!rows[0]) throw new Error("A ação do Xavier não foi encontrada para atualização");
  return { ...rows[0], metadata: cleanJsonObject(rows[0].metadata), attachments: cleanAttachments(rows[0].attachments) };
}

export async function executeApprovedXavierActionRequest(action: XavierActionRequest): Promise<XavierActionRequest> {
  if (action.status !== "queued") return action;
  const url = executorUrl();
  if (!url) return action;
  const running = await patchAction(action, { status: "running" });
  try {
    const response = await fetch(`${url}/v1/xavier/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Xavier-Action-Secret": ACTION_EXECUTOR_SECRET,
        "Idempotency-Key": running.id,
      },
      body: JSON.stringify({
        id: running.id,
        user_id: running.user_id,
        channel: running.channel,
        conversation_id: running.conversation_id,
        telegram_connection_id: running.telegram_connection_id,
        telegram_chat_id: running.telegram_chat_id,
        kind: running.kind,
        title: running.title,
        request_text: running.request_text,
        metadata: running.metadata,
        approval_code: running.approval_code,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const payload = (await response.json().catch(() => ({}))) as XavierActionExecutorPayload;
    if (!response.ok) throw new Error(`Executor de ações ${response.status}: ${String(payload.error_message || "resposta inválida").slice(0, 300)}`);
    const status = payload.status === "completed" || payload.status === "failed" || payload.status === "queued" || payload.status === "running"
      ? payload.status
      : "completed";
    const resultText = cleanText(payload.result_text, 12_000);
    const errorMessage = cleanText(payload.error_message, 2_000);
    const attachments = cleanAttachments(payload.attachments);
    return patchAction(running, {
      status,
      result_text: resultText,
      error_message: errorMessage,
      attachments,
      ...(status === "completed" || status === "failed" ? { completed_at: new Date().toISOString() } : {}),
    });
  } catch (error) {
    return patchAction(running, {
      status: "failed",
      error_message: String((error as Error).message || "Falha no executor de ações").slice(0, 2_000),
      completed_at: new Date().toISOString(),
    });
  }
}

const EXTERNAL_PATTERNS = [
  /\b(?:mcp|conectar|conexao|integre|integrar|integração|integracao|webhook|api externa|outro sistema|outros sistemas)\b/i,
  /\b(?:envie|enviar|mande|mandar|publique|publicar|poste|postar|dispare|disparar|convide|convidar|agende|agendar|cancele|cancelar|exclua|excluir|apague|apagar|pague|pagar|deploy|publique|produção|producao)\b/i,
];

export function classifyXavierTaskRequest(message: string): XavierTaskIntent | null {
  const text = normalize(message.trim());
  if (!text) return null;
  const external = EXTERNAL_PATTERNS.some((pattern) => pattern.test(text));
  const isMcp = /\b(?:mcp|model context protocol|servidor mcp|ferramenta mcp)\b/i.test(text);
  const isVideo = /\b(?:video|videos|filme|animacao|animação|clipe|reels?)\b/i.test(text);
  const isImage = /\b(?:imagem|imagens|ilustracao|ilustração|arte|logo|banner|foto)\b/i.test(text);
  const isPresentation = /\b(?:apresentacao|apresentações|apresentacoes|slides?|slide deck|powerpoint|pptx?)\b/i.test(text);
  const isPdf = /\bpdf\b/i.test(text);
  const isDocument = /\b(?:documento|documentos|contrato|relatorio|relatório|memorando|oficio|ofício|carta|texto)\b/i.test(text);
  const isSystem = /\b(?:sistema|aplicativo|aplicacao|aplicação|site|website|plataforma|software|codigo|código|programa|projeto)\b/i.test(text);
  if (isMcp) return { kind: "mcp", title: "Conexão MCP solicitada", requiresApproval: true, execution: "mcp" };
  if (isVideo) return { kind: "video", title: "Geração ou edição de vídeo", requiresApproval: true, execution: "provider" };
  if (isImage) return { kind: "image", title: "Geração ou edição de imagem", requiresApproval: true, execution: "provider" };
  if (isPresentation) return { kind: "presentation", title: "Apresentação solicitada", requiresApproval: external, execution: external ? "external" : "local" };
  if (isPdf) return { kind: "pdf", title: "PDF solicitado", requiresApproval: external, execution: external ? "external" : "local" };
  if (isSystem) return { kind: "system", title: "Sistema solicitado", requiresApproval: external, execution: external ? "external" : "local" };
  if (isDocument) return { kind: "document", title: "Documento solicitado", requiresApproval: external, execution: external ? "external" : "local" };
  return null;
}

export function isXavierApprovalCommand(message: string): boolean {
  return /^\s*(?:\/)?(?:aprovar|aprova|autorizar|autorize|confirmar|confirma|approve|confirm)\b/i.test(message.trim()) && Boolean(approvalReference(message));
}

export function isXavierCancellationCommand(message: string): boolean {
  return /^\s*(?:\/)?(?:cancelar|cancele|cancel|recusar|recuse|rejeitar|rejeite)\b/i.test(message.trim()) && Boolean(approvalReference(message));
}

export function approvalReference(message: string): string | null {
  const match = message.trim().match(/^\s*(?:\/)?(?:aprovar|aprova|autorizar|autorize|confirmar|confirma|approve|confirm|cancelar|cancele|cancel|recusar|recuse|rejeitar|rejeite)\b\s*[:#-]?\s*(XAV-[A-Za-z0-9-]{4,80}|[0-9a-f]{8}-[0-9a-f-]{27,36})\b/i);
  return match?.[1]?.trim() || null;
}

export function approvalPrompt(action: Pick<XavierActionRequest, "id" | "approval_code" | "title" | "request_text">): string {
  return `A ação “${action.title}” está pronta para execução, mas pode afetar um serviço externo ou gerar custos. Para autorizar explicitamente, responda “aprovar ${action.approval_code}”. Para cancelar, responda “cancelar ${action.approval_code}”. Solicitação: ${action.request_text.slice(0, 500)}`;
}

export async function createXavierActionRequest(input: {
  userId: string;
  channel: XavierTaskChannel;
  conversationId?: string | null;
  telegramConnectionId?: string | null;
  telegramChatId?: string | null;
  requestText: string;
  intent?: XavierTaskIntent | null;
  metadata?: Record<string, unknown>;
}): Promise<XavierActionRequest> {
  const requestText = cleanText(input.requestText, 12_000);
  if (!requestText) throw new Error("A solicitação do Xavier não pode estar vazia");
  const intent = input.intent || classifyXavierTaskRequest(requestText);
  if (!intent) throw new Error("Não foi possível classificar a ação do Xavier");
  const id = randomUUID();
  const approvalCode = `XAV-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const response = await supabaseRequest(ACTION_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id,
      user_id: input.userId,
      channel: input.channel,
      conversation_id: input.conversationId || null,
      telegram_connection_id: input.telegramConnectionId || null,
      telegram_chat_id: input.telegramChatId || null,
      kind: intent.kind,
      title: intent.title,
      request_text: requestText,
      status: intent.requiresApproval ? "pending_approval" : "queued",
      approval_code: approvalCode,
      metadata: { ...cleanJsonObject(input.metadata), execution: intent.execution },
    }),
  });
  const rows = await readRows<XavierActionRequest>(response, "action insert");
  if (!rows[0]) throw new Error("A solicitação do Xavier não foi persistida");
  return { ...rows[0], metadata: cleanJsonObject(rows[0].metadata), attachments: cleanAttachments(rows[0].attachments) };
}

async function findPendingAction(userId: string, reference?: string | null): Promise<XavierActionRequest | null> {
  const params = new URLSearchParams({ select: ACTION_SELECT, user_id: `eq.${userId}`, status: "eq.pending_approval", order: "created_at.desc", limit: "1" });
  if (reference) {
    const normalized = reference.toUpperCase();
    params.set("or", `(id.eq.${reference},approval_code.eq.${normalized})`);
  }
  const rows = await readRows<XavierActionRequest>(await supabaseRequest(`${ACTION_TABLE}?${params}`), "pending action lookup");
  return rows[0] ? { ...rows[0], metadata: cleanJsonObject(rows[0].metadata), attachments: cleanAttachments(rows[0].attachments) } : null;
}

export async function approveXavierActionRequest(userId: string, reference?: string | null): Promise<XavierActionRequest | null> {
  const action = await findPendingAction(userId, reference);
  if (!action) return null;
  const now = new Date().toISOString();
  const params = new URLSearchParams({ id: `eq.${action.id}`, user_id: `eq.${userId}`, status: "eq.pending_approval" });
  const response = await supabaseRequest(`${ACTION_TABLE}?${params}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "queued", approved_at: now, updated_at: now }),
  });
  const rows = await readRows<XavierActionRequest>(response, "action approval");
  return rows[0] ? { ...rows[0], metadata: cleanJsonObject(rows[0].metadata), attachments: cleanAttachments(rows[0].attachments) } : null;
}

export async function cancelXavierActionRequest(userId: string, reference?: string | null): Promise<XavierActionRequest | null> {
  const action = await findPendingAction(userId, reference);
  if (!action) return null;
  const now = new Date().toISOString();
  const params = new URLSearchParams({ id: `eq.${action.id}`, user_id: `eq.${userId}`, status: "eq.pending_approval" });
  const response = await supabaseRequest(`${ACTION_TABLE}?${params}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "cancelled", updated_at: now, completed_at: now, result_text: "Ação cancelada pelo usuário." }),
  });
  const rows = await readRows<XavierActionRequest>(response, "action cancellation");
  return rows[0] ? { ...rows[0], metadata: cleanJsonObject(rows[0].metadata), attachments: cleanAttachments(rows[0].attachments) } : null;
}

export async function getXavierActionRequest(userId: string, actionId: string): Promise<XavierActionRequest | null> {
  const params = new URLSearchParams({ select: ACTION_SELECT, id: `eq.${actionId}`, user_id: `eq.${userId}`, limit: "1" });
  const rows = await readRows<XavierActionRequest>(await supabaseRequest(`${ACTION_TABLE}?${params}`), "action lookup");
  return rows[0] ? { ...rows[0], metadata: cleanJsonObject(rows[0].metadata), attachments: cleanAttachments(rows[0].attachments) } : null;
}

export function actionReadyMessage(action: XavierActionRequest): string {
  if (action.status === "completed") {
    return action.result_text?.trim()
      ? `A solicitação “${action.title}” foi concluída.\n\n${action.result_text.trim()}`
      : `A solicitação “${action.title}” foi concluída e os arquivos estão disponíveis nesta sessão.`;
  }
  if (action.status === "failed") {
    return `Não foi possível concluir “${action.title}” nesta tentativa. Nenhuma nova autorização foi concedida. Motivo: ${(action.error_message || "o provedor autorizado não respondeu").slice(0, 500)}`;
  }
  if (action.status === "running") return `A solicitação “${action.title}” está em execução no provedor autorizado. O Xavier retornará o resultado nesta mesma sessão.`;
  if (action.status === "queued") return `A solicitação “${action.title}” foi autorizada e entrou na fila segura. Nenhum recurso externo será acionado fora do provedor autorizado.`;
  if (action.status === "cancelled") return `A solicitação “${action.title}” foi cancelada e nenhum recurso externo foi acionado.`;
  return approvalPrompt(action);
}
