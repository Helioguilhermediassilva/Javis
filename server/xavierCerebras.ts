const CEREBRAS_DEFAULT_BASE_URL = "https://api.cerebras.ai/v1";
const CEREBRAS_DEFAULT_MODEL = "gpt-oss-120b";
const CEREBRAS_DEFAULT_MAX_COMPLETION_TOKENS = 512;
const CEREBRAS_DEFAULT_TIMEOUT_MS = 20_000;
const CEREBRAS_MAX_HISTORY_MESSAGES = 8;
const CEREBRAS_MAX_SYSTEM_CHARS = 8_000;
const CEREBRAS_MAX_MESSAGE_CHARS = 3_000;
const CEREBRAS_MAX_HISTORY_CHARS = 18_000;

export type CerebrasMessageRole = "system" | "user" | "assistant";

export interface CerebrasMessage {
  role: CerebrasMessageRole;
  content: string;
}

export interface CerebrasUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface CerebrasCompletion {
  provider: "cerebras";
  model: string;
  content: string;
  usage?: CerebrasUsage;
}

export class XavierCerebrasUpstreamError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "XavierCerebrasUpstreamError";
  }
}

function cleanBaseUrl(value: string): string {
  return (value.trim() || CEREBRAS_DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function cleanModel(value: string): string {
  return (value.trim() || CEREBRAS_DEFAULT_MODEL).slice(0, 160);
}

function boundedPositiveInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(Math.round(parsed), maximum));
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const value = part as { type?: unknown; text?: unknown };
      return value.type === "text" && typeof value.text === "string" ? value.text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function normalizeMessage(message: { role?: unknown; content?: unknown }, maxChars: number): CerebrasMessage | null {
  if (message.role !== "system" && message.role !== "user" && message.role !== "assistant") return null;
  const content = contentToText(message.content).replace(/\u0000/g, "").trim().slice(0, maxChars);
  return content ? { role: message.role, content } : null;
}

export function isCerebrasConfigured(): boolean {
  return Boolean((process.env.CEREBRAS_API_KEY || "").trim())
    && (process.env.CEREBRAS_FAST_PATH_ENABLED || "true").trim().toLowerCase() !== "false";
}

export function getCerebrasModel(): string {
  return cleanModel(process.env.CEREBRAS_MODEL || "");
}

export function getCerebrasBaseUrl(): string {
  return cleanBaseUrl(process.env.CEREBRAS_BASE_URL || "");
}

export function buildCerebrasMessages(input: {
  systemPrompt: string;
  history?: ReadonlyArray<{ role?: unknown; content?: unknown }>;
  userMessage: string;
}): CerebrasMessage[] {
  const systemPrompt = input.systemPrompt.replace(/\u0000/g, "").trim().slice(0, CEREBRAS_MAX_SYSTEM_CHARS);
  const history = (input.history || [])
    .slice(-CEREBRAS_MAX_HISTORY_MESSAGES)
    .map((message) => normalizeMessage(message, CEREBRAS_MAX_MESSAGE_CHARS))
    .filter((message): message is CerebrasMessage => Boolean(message));
  const boundedHistory: CerebrasMessage[] = [];
  let historyChars = 0;
  for (const message of history) {
    if (historyChars + message.content.length > CEREBRAS_MAX_HISTORY_CHARS) break;
    boundedHistory.push(message);
    historyChars += message.content.length;
  }
  const messages: CerebrasMessage[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push(...boundedHistory.filter((message) => message.role !== "system"));
  const userMessage = input.userMessage.replace(/\u0000/g, "").trim().slice(0, CEREBRAS_MAX_MESSAGE_CHARS);
  if (userMessage) messages.push({ role: "user", content: userMessage });
  return messages;
}

function safeUpstreamDetail(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    return String(parsed.error?.message || parsed.message || raw).replace(/\s+/g, " ").trim().slice(0, 320);
  } catch {
    return raw.replace(/\s+/g, " ").trim().slice(0, 320);
  }
}

function parseUsage(value: unknown): CerebrasUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as Record<string, unknown>;
  const result: CerebrasUsage = {};
  for (const key of ["prompt_tokens", "completion_tokens", "total_tokens"] as const) {
    const numberValue = usage[key];
    if (typeof numberValue === "number" && Number.isFinite(numberValue)) result[key] = Math.max(0, Math.round(numberValue));
  }
  return Object.keys(result).length ? result : undefined;
}

export function parseCerebrasCompletion(raw: string, requestedModel = getCerebrasModel()): CerebrasCompletion {
  let payload: {
    model?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: unknown;
  };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    throw new XavierCerebrasUpstreamError(502, "Cerebras retornou JSON inválido");
  }
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new XavierCerebrasUpstreamError(502, "Cerebras não retornou uma resposta textual");
  }
  return {
    provider: "cerebras",
    model: typeof payload.model === "string" && payload.model.trim() ? payload.model.trim().slice(0, 160) : requestedModel,
    content: content.trim(),
    usage: parseUsage(payload.usage),
  };
}

export async function requestCerebrasCompletion(
  messages: CerebrasMessage[],
  options: { maxCompletionTokens?: number; timeoutMs?: number } = {},
): Promise<CerebrasCompletion> {
  const apiKey = (process.env.CEREBRAS_API_KEY || "").trim();
  if (!apiKey) throw new XavierCerebrasUpstreamError(503, "Cerebras não configurada no servidor");
  const model = getCerebrasModel();
  const maxCompletionTokens = Math.max(64, Math.min(Math.round(options.maxCompletionTokens || boundedPositiveInteger(process.env.CEREBRAS_MAX_COMPLETION_TOKENS, CEREBRAS_DEFAULT_MAX_COMPLETION_TOKENS, 64, 768)), 768));
  const timeoutMs = Math.max(5_000, Math.min(Math.round(options.timeoutMs || boundedPositiveInteger(process.env.CEREBRAS_TIMEOUT_MS, CEREBRAS_DEFAULT_TIMEOUT_MS, 5_000, 30_000)), 30_000));
  const response = await fetch(`${getCerebrasBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_completion_tokens: maxCompletionTokens,
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = await response.text();
  if (!response.ok) throw new XavierCerebrasUpstreamError(response.status, `cerebras ${response.status}: ${safeUpstreamDetail(raw)}`);
  return parseCerebrasCompletion(raw, model);
}

function normalizeForRouting(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const NON_FAST_REQUEST = /\b(?:pesquis|internet|atual|recente|notici|mercado|benchmark|compar|youtube|google|instagram|tiktok|comentari|fonte|dados|crm|registr|agenda|calend|email|public|agend|exclu|delet|arquivo|documento|planilha|apresent|slide|imagem|video|audio|pdf|pptx?|docx?|xlsx?|svg|editar|alterar|gerar|criar|desenvolver|construir|programar|codigo|código|mcp|integrar|conectar|ferramenta|tool|aprov|cancelar)[a-z]*\b/i;
const EXPLICIT_ENGINE = /(?:^|\s)\/(?:claude|openrouter|grok|manus|cerebras)\b/i;

export function shouldUseCerebrasFastPath(input: {
  engine?: string;
  userMessage: string;
  history?: ReadonlyArray<{ role?: unknown; content?: unknown }>;
  attachments?: ReadonlyArray<unknown>;
  hasAudio?: boolean;
  hasActiveFile?: boolean;
}): boolean {
  if (!isCerebrasConfigured()) return false;
  if ((input.engine || "auto") !== "auto") return false;
  if (input.hasAudio || input.hasActiveFile || (input.attachments?.length || 0) > 0) return false;
  const message = normalizeForRouting(input.userMessage.trim());
  if (!message || message.length > 2_000 || EXPLICIT_ENGINE.test(message) || NON_FAST_REQUEST.test(message)) return false;
  const historyChars = (input.history || []).reduce((total, item) => total + Math.min(contentToText(item.content).length, CEREBRAS_MAX_MESSAGE_CHARS), 0);
  return historyChars <= CEREBRAS_MAX_HISTORY_CHARS;
}

export async function generateCerebrasReply(input: {
  systemPrompt: string;
  history?: ReadonlyArray<{ role?: unknown; content?: unknown }>;
  userMessage: string;
  maxCompletionTokens?: number;
  timeoutMs?: number;
}): Promise<CerebrasCompletion> {
  const messages = buildCerebrasMessages(input);
  if (!messages.some((message) => message.role === "user")) {
    throw new XavierCerebrasUpstreamError(400, "Mensagem do usuário vazia para Cerebras");
  }
  return requestCerebrasCompletion(messages, {
    maxCompletionTokens: input.maxCompletionTokens,
    timeoutMs: input.timeoutMs,
  });
}
