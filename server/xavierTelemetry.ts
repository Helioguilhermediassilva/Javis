import { applySupabaseAdminHeaders } from "./supabaseAdmin";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const TABLE = "xavier_usage_events";

export type XavierTelemetryChannel = "web" | "telegram" | "system";
export type XavierTelemetryStatus = "started" | "success" | "error";

export type XavierTelemetryEventName =
  | "chat_request"
  | "chat_response"
  | "chat_error"
  | "research_request"
  | "tool_call"
  | "voice_transcription"
  | "voice_synthesis"
  | "artifact_pdf"
  | "artifact_presentation"
  | "artifact_download"
  | "telegram_message"
  | "telegram_connection"
  | "auth_failure"
  | "rate_limited"
  | "provider_failure";

export interface XavierUsageEventInput {
  userId?: string | null;
  requestId?: string | null;
  channel: XavierTelemetryChannel;
  eventName: XavierTelemetryEventName;
  status?: XavierTelemetryStatus;
  provider?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}

function boundedInteger(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(Math.round(value), 2_147_483_647));
}

function boundedCost(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(Number(value.toFixed(8)), 9_999_999.99999999));
}

function sanitizeText(value: string | null | undefined, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[\r\n\t]+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

const PRIVATE_METADATA_KEYS = /(?:prompt|response|reply|content|text|message|transcript|audio|speech|body|token|secret|credential|password|authorization|api[_-]?key|cookie|email)/i;

function sanitizeMetadata(
  metadata: Record<string, string | number | boolean | null> | undefined,
): Record<string, string | number | boolean | null> {
  if (!metadata) return {};
  const entries: Array<[string, string | number | boolean | null]> = [];
  for (const [key, value] of Object.entries(metadata).slice(0, 40)) {
    const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 64);
    if (!safeKey || PRIVATE_METADATA_KEYS.test(safeKey)) continue;
    if (typeof value === "string") entries.push([safeKey, value.replace(/[\r\n\t]+/g, " ").slice(0, 200)]);
    else if (typeof value === "number" && Number.isFinite(value)) entries.push([safeKey, value]);
    else if (typeof value === "boolean" || value === null) entries.push([safeKey, value]);
  }
  return Object.fromEntries(entries.slice(0, 20));
}

export function buildXavierUsageEventRow(input: XavierUsageEventInput): Record<string, unknown> {
  return {
    user_id: sanitizeText(input.userId, 128),
    request_id: sanitizeText(input.requestId, 128),
    channel: input.channel,
    event_name: input.eventName,
    status: input.status || "success",
    provider: sanitizeText(input.provider, 80),
    model: sanitizeText(input.model, 120),
    latency_ms: boundedInteger(input.latencyMs),
    input_tokens: boundedInteger(input.inputTokens),
    output_tokens: boundedInteger(input.outputTokens),
    estimated_cost_usd: boundedCost(input.estimatedCostUsd),
    metadata: sanitizeMetadata(input.metadata),
  };
}

export async function recordXavierUsageEvent(input: XavierUsageEventInput): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: applySupabaseAdminHeaders({ headers: { Prefer: "return=minimal" } }),
      body: JSON.stringify(buildXavierUsageEventRow(input)),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ event: "xavier_telemetry_write_failed", status: response.status }));
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "xavier_telemetry_write_failed", error: String(error).slice(0, 160) }));
  }
}

export function recordXavierUsageEventDetached(input: XavierUsageEventInput): void {
  void recordXavierUsageEvent(input);
}
