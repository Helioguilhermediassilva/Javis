export type XavierLlmProvider = "openrouter" | "legacy";

export interface XavierLlmRoute {
  provider: XavierLlmProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  fallbackModels: string[];
  headers: Record<string, string>;
  dataCollection?: "allow" | "deny";
}

const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
const OPENROUTER_DEFAULT_FALLBACKS = [
  "openai/gpt-5.6-luna",
  "moonshotai/kimi-k2.5",
];
const LEGACY_DEFAULT_MODEL = "grok-4.3";
const MAX_FALLBACK_MODELS = 4;

function cleanBaseUrl(value: string, fallback: string): string {
  const candidate = value.trim().replace(/\/+$/, "");
  return candidate || fallback;
}

function cleanModel(value: string, fallback: string): string {
  const candidate = value.trim().slice(0, 160);
  return candidate || fallback;
}

function parseModelList(value: string | undefined, defaults: string[]): string[] {
  const list = (value || "")
    .split(",")
    .map((model) => model.trim().slice(0, 160))
    .filter(Boolean)
    .filter((model, index, all) => all.indexOf(model) === index)
    .slice(0, MAX_FALLBACK_MODELS);
  return list.length ? list : defaults;
}

function openRouterDataCollection(): "allow" | "deny" {
  return (process.env.OPENROUTER_DATA_COLLECTION || "deny").trim().toLowerCase() === "allow" ? "allow" : "deny";
}

export function isOpenRouterConfigured(): boolean {
  return Boolean((process.env.OPENROUTER_API_KEY || "").trim());
}

export function getXavierLlmRoute(): XavierLlmRoute | null {
  const openRouterKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (openRouterKey) {
    const siteUrl = (process.env.OPENROUTER_SITE_URL || "https://jarvisnowgo.com").trim().slice(0, 500);
    const appName = (process.env.OPENROUTER_APP_NAME || "Xavier - NowGo").trim().slice(0, 120);
    const model = cleanModel(process.env.OPENROUTER_MODEL || "", OPENROUTER_DEFAULT_MODEL);
    const allFallbacks = parseModelList(process.env.OPENROUTER_FALLBACK_MODELS, OPENROUTER_DEFAULT_FALLBACKS)
      .filter((fallback) => fallback !== model);
    return {
      provider: "openrouter",
      baseUrl: cleanBaseUrl(process.env.OPENROUTER_API_URL || process.env.OPENROUTER_BASE_URL || "", OPENROUTER_DEFAULT_BASE_URL),
      apiKey: openRouterKey,
      model,
      fallbackModels: allFallbacks,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${openRouterKey}`,
        "HTTP-Referer": siteUrl,
        "X-Title": appName,
      },
      dataCollection: openRouterDataCollection(),
    };
  }

  const legacyKey = (process.env.LLM_API_KEY || process.env.XAI_API_KEY || "").trim();
  if (!legacyKey) return null;
  return {
    provider: "legacy",
    baseUrl: cleanBaseUrl(process.env.LLM_API_URL || process.env.XAI_API_URL || "", "https://api.x.ai"),
    apiKey: legacyKey,
    model: LEGACY_DEFAULT_MODEL,
    fallbackModels: [],
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${legacyKey}`,
    },
  };
}

export function llmCompletionsUrl(route: XavierLlmRoute): string {
  if (route.provider === "legacy" && !/\/v1$/i.test(route.baseUrl)) {
    return `${route.baseUrl}/v1/chat/completions`;
  }
  return `${route.baseUrl}/chat/completions`;
}

export function buildXavierLlmBody(
  route: XavierLlmRoute,
  messages: Array<Record<string, unknown>>,
  tools: Array<Record<string, unknown>>,
  stream = false,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: route.model,
    messages,
    tools,
    tool_choice: "auto",
    temperature: 0.7,
    max_tokens: 600,
    stream,
  };
  if (route.provider === "openrouter") {
    if (route.fallbackModels.length) body.models = [route.model, ...route.fallbackModels];
    body.provider = {
      allow_fallbacks: true,
      require_parameters: true,
      data_collection: route.dataCollection || "deny",
    };
  }
  return body;
}

export interface XavierLlmUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface XavierLlmCompletion {
  content: string;
  toolCalls: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
  model: string;
  provider: XavierLlmProvider;
  usage?: XavierLlmUsage;
}

export class XavierLlmUpstreamError extends Error {
  constructor(
    public readonly provider: XavierLlmProvider,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "XavierLlmUpstreamError";
  }
}

function safeUpstreamDetail(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    return String(parsed.error?.message || parsed.message || raw).replace(/\s+/g, " ").trim().slice(0, 320);
  } catch {
    return raw.replace(/\s+/g, " ").trim().slice(0, 320);
  }
}

export function parseXavierLlmCompletion(route: XavierLlmRoute, raw: string): XavierLlmCompletion {
  let payload: {
    model?: string;
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{ id?: string; type?: string; function?: { name?: string; arguments?: string } }>;
      };
    }>;
    usage?: XavierLlmUsage;
  };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    throw new XavierLlmUpstreamError(route.provider, 502, `${route.provider} retornou JSON inválido`);
  }
  const message = payload.choices?.[0]?.message;
  if (!message) throw new XavierLlmUpstreamError(route.provider, 502, `${route.provider} não retornou uma resposta`);
  return {
    content: typeof message.content === "string" ? message.content : "",
    toolCalls: (message.tool_calls || []).map((toolCall, index) => ({
      id: toolCall.id || `call_${index + 1}`,
      type: toolCall.type || "function",
      function: {
        name: toolCall.function?.name || "",
        arguments: toolCall.function?.arguments || "{}",
      },
    })),
    model: typeof payload.model === "string" && payload.model ? payload.model : route.model,
    provider: route.provider,
    usage: payload.usage,
  };
}

export async function requestXavierLlmCompletion(
  route: XavierLlmRoute,
  messages: Array<Record<string, unknown>>,
  tools: Array<Record<string, unknown>>,
  timeoutMs = 110_000,
): Promise<XavierLlmCompletion> {
  const response = await fetch(llmCompletionsUrl(route), {
    method: "POST",
    headers: route.headers,
    body: JSON.stringify(buildXavierLlmBody(route, messages, tools, false)),
    signal: AbortSignal.timeout(Math.min(Math.max(timeoutMs, 5_000), 110_000)),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new XavierLlmUpstreamError(route.provider, response.status, `${route.provider} ${response.status}: ${safeUpstreamDetail(raw)}`);
  }
  return parseXavierLlmCompletion(route, raw);
}
