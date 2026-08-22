import { randomUUID } from "node:crypto";
import type { XavierPlan } from "./xavierEntitlements.js";
import { applySupabaseAdminHeaders } from "./supabaseAdmin.js";
import { executeXavierRunwayMediaAction, executeXavierVisualPresentationAction, isXavierRunwayConfigured } from "./xavierMedia.js";
import { captureXavierCredits, creditBlockedMessage, creditLowBalanceMessage, releaseXavierCredits, reserveXavierCredits } from "./xavierCredits.js";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const ACTION_TABLE = "xavier_action_requests";
const ACTION_SELECT = "id,user_id,channel,conversation_id,telegram_connection_id,telegram_chat_id,kind,title,request_text,status,approval_code,metadata,result_text,attachments,error_message,created_at,updated_at,approved_at,completed_at";
const ACTION_EXECUTOR_URL = (process.env.XAVIER_ACTION_EXECUTOR_URL || "").trim().replace(/\/+$/, "");
const ACTION_EXECUTOR_SECRET = (process.env.XAVIER_ACTION_EXECUTOR_SECRET || "").trim();

export type XavierTaskChannel = "web" | "telegram";
export type XavierTaskKind = "document" | "pdf" | "presentation" | "spreadsheet" | "image" | "video" | "system" | "mcp" | "external";
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

function rawActionError(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error || "Falha desconhecida");
  return value.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").replace(/https?:\/\/[^\s]+/gi, (url) => url.split("?")[0]).slice(0, 600);
}

export function formatXavierActionFailure(error: unknown): string {
  const raw = rawActionError(error);
  const normalized = raw.toLowerCase();
  if (/runway.*(?:401|403)|(?:401|403).*runway|unauthori[sz]ed|forbidden|invalid.*(?:api|secret).*key/.test(normalized)) {
    return "A chave do Runway foi rejeitada. Verifique a RUNWAY_API_SECRET no projeto Vercel do Xavier e publique um novo deployment.";
  }
  if (/runway.*(?:402|credit|saldo|billing|payment)|(?:402|credit|saldo insuficiente|insufficient|payment required)/.test(normalized)) {
    return "O saldo da API do Runway não foi suficiente para esta apresentação. Os créditos da API são separados da assinatura do aplicativo Runway; adicione créditos no portal de desenvolvedor ou compre créditos adicionais no Xavier para continuar.";
  }
  if (/runway.*(?:429|rate.?limit|too many requests)|(?:429|rate.?limit|too many requests).*runway/.test(normalized)) {
    return "O Runway atingiu temporariamente o limite de solicitações. Aguarde alguns instantes e tente novamente; o Xavier não concedeu uma nova autorização nem repetirá a cobrança automaticamente.";
  }
  if (/runway.*(?:timeout|timed out|excedeu o tempo)|(?:timeout|timed out|excedeu o tempo).*runway/.test(normalized)) {
    return "O Runway demorou além do limite para concluir a mídia. A ação foi encerrada sem nova tentativa automática; tente novamente em alguns instantes.";
  }
  if (/413|payload too large|entitytoolarge|tamanho acima do limite|maximum allowed size/.test(normalized) && /imagem da apresentação|pptx|apresenta(?:ção|cao)|storage|upload/.test(normalized)) {
    return "A mídia foi autorizada, mas a apresentação ficou maior que o limite seguro de armazenamento. A ação foi encerrada sem nova cobrança; tente novamente com menos imagens ou imagens mais simples.";
  }
  if (/imagem da apresentação|pptx|apresenta(?:ção|cao)|supabase media|storage|signed url|download de mídia|formato de imagem/.test(normalized)) {
    return `A mídia foi autorizada, mas não foi possível compor ou armazenar a apresentação. ${raw ? `Detalhe técnico: ${raw.slice(0, 300)}` : "Tente novamente em alguns instantes."}`;
  }
  if (/executor.*(?:não está configurado|nao esta configurado)|executor de ações/.test(normalized)) {
    return "O executor seguro do Xavier ainda não está disponível em produção. Nenhum serviço externo foi acionado; fale com o administrador para revisar a configuração.";
  }
  if (/timeout|timed out|abort|network|fetch failed|econn|enotfound/.test(normalized)) {
    return "O provedor não respondeu a tempo. A ação foi encerrada sem nova autorização; tente novamente em alguns instantes.";
  }
  return `A ação não foi concluída. ${raw ? `Detalhe técnico: ${raw.slice(0, 350)}` : "Tente novamente em alguns instantes."}`;
}

async function markActionFailed(action: XavierActionRequest, error: unknown): Promise<XavierActionRequest> {
  const message = formatXavierActionFailure(error);
  const patch = {
    status: "failed" as const,
    error_message: message,
    result_text: message,
    completed_at: new Date().toISOString(),
  };
  try {
    const failed = await patchAction(action, patch);
    await releaseXavierCredits(action);
    return failed;
  } catch (persistError) {
    await releaseXavierCredits(action);
    console.error("[xavier-actions] failed action persistence", { actionId: action.id, error: rawActionError(persistError) });
    return { ...action, ...patch, attachments: [], updated_at: new Date().toISOString() };
  }
}

export async function completeXavierLocalAction(input: {
  action: XavierActionRequest;
  resultText: string;
  attachments?: XavierActionAttachment[];
  actualUnits?: number;
}): Promise<XavierActionRequest> {
  const { action } = input;
  if (action.metadata.credit_blocked === true) return action;
  if (action.status !== "queued" && action.status !== "running") return action;
  try {
    const running = action.status === "running" ? action : await patchAction(action, { status: "running" });
    const completed = await patchAction(running, {
      status: "completed",
      result_text: cleanText(input.resultText, 12_000),
      attachments: input.attachments || [],
      completed_at: new Date().toISOString(),
    });
    await captureXavierCredits(completed, input.actualUnits);
    return completed;
  } catch (error) {
    return markActionFailed(action, error);
  }
}

export async function failXavierLocalAction(action: XavierActionRequest, error: unknown): Promise<XavierActionRequest> {
  return markActionFailed(action, error);
}

export async function executeApprovedXavierActionRequest(action: XavierActionRequest): Promise<XavierActionRequest> {
  if (action.status !== "queued") return action;
  const isDirectRunwayAction = action.kind === "image" || action.kind === "video" || (action.kind === "presentation" && action.metadata.visual_presentation === true);
  if (isDirectRunwayAction && !isXavierRunwayConfigured()) {
    return markActionFailed(action, "O provedor Runway não está configurado no projeto Xavier. Adicione RUNWAY_API_SECRET no ambiente de produção e tente novamente.");
  }
  const url = executorUrl();
  if (!isDirectRunwayAction && !url) {
    return markActionFailed(action, "O executor externo do Xavier não está configurado no ambiente de produção.");
  }
  let running: XavierActionRequest;
  try {
    running = await patchAction(action, { status: "running" });
  } catch (error) {
    return markActionFailed(action, error);
  }
  try {
    if (isDirectRunwayAction) {
      const result = action.kind === "presentation"
        ? await executeXavierVisualPresentationAction(running)
        : await executeXavierRunwayMediaAction(running);
      const completed = await patchAction(running, {
        status: "completed",
        result_text: result.result_text,
        attachments: result.attachments,
        completed_at: new Date().toISOString(),
      });
      await captureXavierCredits(completed);
      return completed;
    }
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
    const updated = await patchAction(running, {
      status,
      result_text: resultText,
      error_message: errorMessage,
      attachments,
      ...(status === "completed" || status === "failed" ? { completed_at: new Date().toISOString() } : {}),
    });
    if (status === "completed") await captureXavierCredits(updated);
    if (status === "failed") await releaseXavierCredits(updated);
    return updated;
  } catch (error) {
    return markActionFailed(running, error);
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
  const isImage = /\b(?:imagem|imagens|ilustracao|ilustração|arte|logo|banner|foto|icone|ícone|infografico|infográfico)\b/i.test(text);
  const isSpreadsheet = /\b(?:planilha|planilhas|excel|xlsx|xls|csv|tabela|orcamento|orçamento)\b/i.test(text);
  const isPresentation = /\b(?:apresentacao|apresentações|apresentacoes|slides?|slide deck|powerpoint|pptx?)\b/i.test(text);
  const isPdf = /\bpdf\b/i.test(text);
  const isDocument = /\b(?:documento|documentos|contrato|relatorio|relatório|memorando|oficio|ofício|carta|texto)\b/i.test(text);
  const isSystem = /\b(?:sistema|aplicativo|aplicacao|aplicação|site|website|plataforma|software|codigo|código|programa|projeto)\b/i.test(text);
  if (isMcp) return { kind: "mcp", title: "Conexão MCP solicitada", requiresApproval: true, execution: "mcp" };
  if (isVideo) return { kind: "video", title: "Geração ou edição de vídeo", requiresApproval: true, execution: "provider" };
  if (isPresentation) {
    const visualPresentation = /\b(?:imagem|imagens|foto|fotos|visual|visuais|ilustracao|ilustracao|grafico|graficos|capa|figura|arte)\b/i.test(text);
    return { kind: "presentation", title: visualPresentation ? "Apresentação com imagens solicitada" : "Apresentação solicitada", requiresApproval: external || visualPresentation, execution: visualPresentation ? "provider" : (external ? "external" : "local") };
  }
  if (isImage) return { kind: "image", title: "Geração ou edição de imagem", requiresApproval: true, execution: "provider" };
  if (isSpreadsheet) return { kind: "spreadsheet", title: "Planilha solicitada", requiresApproval: external, execution: external ? "external" : "local" };
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

const VISUAL_REQUEST_PATTERN = /\b(?:imagem|imagens|foto|fotos|visual|visuais|ilustracao|ilustrações|grafico|graficos|capa|figura|arte)\b/i;
const REFINEMENT_REQUEST_PATTERN = /\b(?:adicionar|adicione|acrescentar|acrescente|incluir|inclua|editar|edite|alterar|altere|ajustar|ajuste|refinar|refine|melhorar|melhore|revisar|revise|atualizar|atualize|mudar|mude|trocar|troque|corrigir|corrija|deixar|deixe|transformar|transforme)\b/i;

function detectRequestedImageCount(requestText: string, metadata: Record<string, unknown>): number | undefined {
  const supplied = Number(metadata.new_image_count ?? metadata.image_count);
  if (Number.isFinite(supplied) && supplied >= 0) return Math.min(6, Math.floor(supplied));
  if (!VISUAL_REQUEST_PATTERN.test(requestText)) return undefined;
  if (/\b(?:uma|um|1)\s+(?:nova?\s+)?(?:imagem|foto|figura)\b/i.test(requestText)) return 1;
  if (/\b(?:duas|dois|2)\s+(?:novas?\s+)?(?:imagens?|fotos?|figuras?)\b/i.test(requestText)) return 2;
  if (/\b(?:tres|três|3)\s+(?:novas?\s+)?(?:imagens?|fotos?|figuras?)\b/i.test(requestText)) return 3;
  if (/\b(?:quatro|4)\s+(?:novas?\s+)?(?:imagens?|fotos?|figuras?)\b/i.test(requestText)) return 4;
  return 3;
}

export function deriveXavierActionMetadata(requestText: string, metadata: Record<string, unknown>, kind: XavierTaskKind): Record<string, unknown> {
  const derived = { ...metadata };
  const isVisualPresentation = kind === "presentation" && VISUAL_REQUEST_PATTERN.test(requestText);
  const isRefinement = Boolean(derived.refinement || derived.is_refinement || derived.refine_existing_artifact || derived.artifact_refinement) || REFINEMENT_REQUEST_PATTERN.test(requestText);
  const imageCount = kind === "presentation" ? detectRequestedImageCount(requestText, derived) : undefined;
  if (isVisualPresentation) derived.visual_presentation = true;
  if (isRefinement) derived.refinement = true;
  if (imageCount !== undefined) derived.new_image_count = imageCount;
  return derived;
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
      metadata: {
        ...deriveXavierActionMetadata(requestText, cleanJsonObject(input.metadata), intent.kind),
        execution: intent.execution,
      },
    }),
  });
  const rows = await readRows<XavierActionRequest>(response, "action insert");
  if (!rows[0]) throw new Error("A solicitação do Xavier não foi persistida");
  const action = { ...rows[0], metadata: cleanJsonObject(rows[0].metadata), attachments: cleanAttachments(rows[0].attachments) };
  // Toda tarefa que gera ou transforma um artefato consome a franquia. A aprovação
  // explícita continua reservada para ações externas quando os créditos automáticos
  // estão desativados ou quando a tarefa ultrapassa o saldo disponível.
  const creditDecision = await reserveXavierCredits({ action, plan: input.metadata?.plan as XavierPlan | undefined });
  if (!creditDecision.enabled) return action;
  if (!creditDecision.ok) {
    return patchAction(action, {
      status: "pending_approval",
      metadata: {
        ...action.metadata,
        credit_blocked: true,
        credit_required_units: creditDecision.requiredUnits,
        credit_available_units: creditDecision.availableUnits,
      },
    });
  }
  return patchAction(action, {
    status: "queued",
    approved_at: new Date().toISOString(),
    metadata: {
      ...action.metadata,
      credit_reserved_units: creditDecision.reservation?.requiredUnits || creditDecision.requiredUnits,
      credit_available_after: creditDecision.reservation?.availableUnits || 0,
      credit_low_balance: creditDecision.reservation?.lowBalance || false,
      credit_reservation_id: creditDecision.reservation?.reservationId || null,
      credit_auto_approved: true,
    },
  });
}

const ACTION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTION_CODE_PATTERN = /^XAV-[0-9A-F]{8}$/i;

export function getXavierActionReferenceFilter(reference?: string | null): { field: "id" | "approval_code"; value: string } | null {
  const trimmed = reference?.trim() || "";
  if (!trimmed) return null;
  if (ACTION_ID_PATTERN.test(trimmed)) return { field: "id", value: trimmed };
  const normalized = trimmed.toUpperCase();
  if (ACTION_CODE_PATTERN.test(normalized)) return { field: "approval_code", value: normalized };
  return null;
}

async function findPendingAction(userId: string, reference?: string | null): Promise<XavierActionRequest | null> {
  const params = new URLSearchParams({ select: ACTION_SELECT, user_id: `eq.${userId}`, status: "eq.pending_approval", order: "created_at.desc", limit: "1" });
  if (reference) {
    const filter = getXavierActionReferenceFilter(reference);
    if (!filter) return null;
    params.set(filter.field, `eq.${filter.value}`);
  }
  const rows = await readRows<XavierActionRequest>(await supabaseRequest(`${ACTION_TABLE}?${params}`), "pending action lookup");
  return rows[0] ? { ...rows[0], metadata: cleanJsonObject(rows[0].metadata), attachments: cleanAttachments(rows[0].attachments) } : null;
}

export async function approveXavierActionRequest(userId: string, reference?: string | null): Promise<XavierActionRequest | null> {
  const action = await findPendingAction(userId, reference);
  if (!action) return null;
  if (action.metadata.credit_blocked === true) return action;
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
  if (action.metadata.credit_blocked === true) return creditBlockedMessage(action);
  if (action.status === "completed") {
    const base = action.result_text?.trim()
      ? `A solicitação “${action.title}” foi concluída.\n\n${action.result_text.trim()}`
      : `A solicitação “${action.title}” foi concluída e os arquivos estão disponíveis nesta sessão.`;
    return `${base}${creditLowBalanceMessage(action)}`;
  }
  if (action.status === "failed") {
    return `Não foi possível concluir “${action.title}” nesta tentativa. Nenhuma nova autorização foi concedida. ${action.error_message || "O provedor autorizado não respondeu."}`;
  }
  if (action.status === "running") return `A solicitação “${action.title}” está em execução no provedor autorizado. O Xavier retornará o resultado nesta mesma sessão.`;
  if (action.status === "queued") return `A solicitação “${action.title}” foi autorizada e entrou na fila segura. Nenhum recurso externo será acionado fora do provedor autorizado.`;
  if (action.status === "cancelled") return `A solicitação “${action.title}” foi cancelada e nenhum recurso externo foi acionado.`;
  return approvalPrompt(action);
}
