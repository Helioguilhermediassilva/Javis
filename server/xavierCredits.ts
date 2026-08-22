import { applySupabaseAdminHeaders } from "./supabaseAdmin.js";
import type { XavierPlan } from "./xavierEntitlements.js";
import type { XavierTaskKind, XavierActionRequest } from "./xavierTaskOrchestrator.js";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const CREDITS_URL = (process.env.XAVIER_CREDITS_URL || "https://www.nowgoai.com/#pricing").trim();
const AUTO_CREDITS = process.env.XAVIER_AUTO_CREDITS_ENABLED !== "false";

export interface XavierCreditBalance {
  included_remaining: number;
  purchased_remaining: number;
  total_remaining: number;
  low_balance: boolean;
  cycle_start: string;
  cycle_end: string;
}

export interface XavierCreditReservation {
  reservationId: string;
  requiredUnits: number;
  availableUnits: number;
  lowBalance: boolean;
}

export interface XavierCreditDecision {
  enabled: boolean;
  ok: boolean;
  reason: string;
  requiredUnits: number;
  availableUnits: number;
  reservation?: XavierCreditReservation;
}

function planAllowance(plan: XavierPlan | null | undefined): number {
  const defaults: Record<XavierPlan, number> = { individual: 1_000, pro: 5_000, business: 15_000 };
  const key = plan || "individual";
  const envName = `XAVIER_INCLUDED_CREDITS_${key.toUpperCase()}`;
  const configured = Number(process.env[envName]);
  return Number.isFinite(configured) && configured >= 0 ? Math.floor(configured) : defaults[key];
}

function positiveInteger(value: unknown, fallback = 1): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(100_000_000, Math.round(value)));
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: applySupabaseAdminHeaders({ headers: { "Content-Type": "application/json" } }),
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Supabase credit RPC ${name} ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as T;
}

export function isXavierAutomaticCreditsEnabled(): boolean {
  return AUTO_CREDITS;
}

export function getXavierCreditsUrl(): string {
  return /^https:\/\//i.test(CREDITS_URL) ? CREDITS_URL : "https://www.nowgoai.com/#pricing";
}

function configuredUnits(name: string, fallback: number): number {
  const configured = Number(process.env[name]);
  return Number.isFinite(configured) && configured >= 0 ? Math.floor(configured) : fallback;
}

function metadataNumber(metadata: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(metadata[key]);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

export function estimateXavierCreditUnits(input: { kind: XavierTaskKind; requestText: string; metadata?: Record<string, unknown> }): number {
  const text = input.requestText.toLowerCase();
  const metadata = input.metadata || {};
  const hasVisualPresentation = input.kind === "presentation" && Boolean(metadata.visual_presentation);
  const isRefinement = Boolean(metadata.refinement || metadata.is_refinement || metadata.refine_existing_artifact || metadata.artifact_refinement);
  const requestedImageCount = metadataNumber(metadata, "image_count", "new_image_count");
  const imageCount = Math.min(6, Math.max(0, Math.floor(requestedImageCount ?? (hasVisualPresentation ? 3 : 0))));

  if (input.kind === "video") {
    const durationSeconds = metadataNumber(metadata, "duration_seconds", "durationSeconds", "video_duration_seconds") || 5;
    const blocks = Math.max(1, Math.ceil(durationSeconds / 5));
    return configuredUnits("XAVIER_CREDIT_VIDEO_FIRST_5_SECONDS", 40) + (blocks - 1) * configuredUnits("XAVIER_CREDIT_VIDEO_ADDITIONAL_5_SECONDS", 25);
  }
  if (input.kind === "image") return configuredUnits("XAVIER_CREDIT_IMAGE_UNITS", 8);
  if (hasVisualPresentation) {
    const base = configuredUnits(isRefinement ? "XAVIER_CREDIT_PRESENTATION_REFINEMENT_BASE_UNITS" : "XAVIER_CREDIT_PRESENTATION_VISUAL_BASE_UNITS", isRefinement ? 2 : 12);
    const perImage = configuredUnits("XAVIER_CREDIT_PRESENTATION_IMAGE_UNITS", 6);
    return base + imageCount * perImage;
  }
  if (input.kind === "presentation") return configuredUnits("XAVIER_CREDIT_PRESENTATION_UNITS", 8);
  if (input.kind === "document" || input.kind === "pdf") return configuredUnits("XAVIER_CREDIT_DOCUMENT_UNITS", 4);
  if (input.kind === "spreadsheet") return configuredUnits("XAVIER_CREDIT_SPREADSHEET_UNITS", 5);
  if (input.kind === "system" || input.kind === "mcp" || input.kind === "external") return configuredUnits("XAVIER_CREDIT_EXTERNAL_ACTION_UNITS", 500);
  return text.length > 4_000 ? configuredUnits("XAVIER_CREDIT_LONG_TEXT_UNITS", 2) : configuredUnits("XAVIER_CREDIT_DEFAULT_UNITS", 2);
}

export async function reserveXavierCredits(input: {
  action: XavierActionRequest;
  plan?: XavierPlan | null;
  requiredUnits?: number;
}): Promise<XavierCreditDecision> {
  const requiredUnits = positiveInteger(input.requiredUnits, estimateXavierCreditUnits({ kind: input.action.kind, requestText: input.action.request_text, metadata: input.action.metadata }));
  if (!AUTO_CREDITS) return { enabled: false, ok: false, reason: "automatic_credits_disabled", requiredUnits, availableUnits: 0 };
  const allowance = planAllowance(input.plan);
  try {
    await rpc<unknown[]>("xavier_sync_credit_wallet", {
      p_user_id: input.action.user_id,
      p_included_units: allowance,
      p_idempotency_key: `grant:${input.action.user_id}:${new Date().toISOString().slice(0, 7)}`,
    });
    const rows = await rpc<Array<{ included_remaining: number; purchased_remaining: number; total_remaining: number; low_balance: boolean; cycle_start: string; cycle_end: string }>>("xavier_credit_balance", { p_user_id: input.action.user_id });
    const balance = rows[0];
    const availableUnits = balance?.total_remaining || 0;
    if (!balance || availableUnits < requiredUnits) {
      return { enabled: true, ok: false, reason: "insufficient_credits", requiredUnits, availableUnits };
    }
    const reserved = await rpc<Array<{ ok: boolean; reason: string; reservation_id: string | null; available_units: number; reserved_units: number }>>("xavier_reserve_credits", {
      p_user_id: input.action.user_id,
      p_action_id: input.action.id,
      p_units: requiredUnits,
      p_idempotency_key: `reserve:${input.action.id}`,
      p_metadata: { kind: input.action.kind, estimate_version: process.env.XAVIER_CREDIT_ESTIMATE_VERSION || "2026-08-22-3" },
    });
    const result = reserved[0];
    if (!result?.ok || !result.reservation_id) return { enabled: true, ok: false, reason: result?.reason || "reservation_failed", requiredUnits, availableUnits: result?.available_units || availableUnits };
    return {
      enabled: true,
      ok: true,
      reason: result.reason,
      requiredUnits,
      availableUnits: result.available_units,
      reservation: { reservationId: result.reservation_id, requiredUnits, availableUnits: result.available_units, lowBalance: Boolean(balance.low_balance) || result.available_units <= Math.max(100, Math.floor(allowance * 0.2)) },
    };
  } catch (error) {
    console.error("[xavier-credits] reserve failed", { actionId: input.action.id, error: error instanceof Error ? error.message : String(error) });
    return { enabled: true, ok: false, reason: "credit_service_unavailable", requiredUnits, availableUnits: 0 };
  }
}

export async function captureXavierCredits(action: XavierActionRequest, actualUnits?: number): Promise<void> {
  const reservationId = typeof action.metadata.credit_reservation_id === "string" ? action.metadata.credit_reservation_id : null;
  if (!reservationId) return;
  try {
    const captured = await rpc<boolean>("xavier_capture_credits", {
      p_reservation_id: reservationId,
      p_actual_units: positiveInteger(actualUnits, Number(action.metadata.credit_reserved_units) || 1),
      p_idempotency_key: `capture:${action.id}`,
      p_metadata: { provider: action.metadata.provider || "xavier" },
    });
    if (!captured) console.error("[xavier-credits] capture exceeded reservation", { actionId: action.id, reservationId });
  } catch (error) {
    console.error("[xavier-credits] capture failed", { actionId: action.id, error: error instanceof Error ? error.message : String(error) });
  }
}

export async function releaseXavierCredits(action: XavierActionRequest): Promise<void> {
  const reservationId = typeof action.metadata.credit_reservation_id === "string" ? action.metadata.credit_reservation_id : null;
  if (!reservationId) return;
  try {
    await rpc<boolean>("xavier_release_credits", { p_reservation_id: reservationId, p_idempotency_key: `release:${action.id}`, p_metadata: { reason: "action_failed_or_cancelled" } });
  } catch (error) {
    console.error("[xavier-credits] release failed", { actionId: action.id, error: error instanceof Error ? error.message : String(error) });
  }
}

export function creditBlockedMessage(action: XavierActionRequest): string {
  const required = Number(action.metadata.credit_required_units) || 0;
  const available = Number(action.metadata.credit_available_units) || 0;
  return `Para continuar com “${action.title}”, esta tarefa precisa de aproximadamente ${required.toLocaleString("pt-BR")} créditos e você tem ${available.toLocaleString("pt-BR")} disponíveis. Adicione créditos pelo sistema de pagamento: ${getXavierCreditsUrl()}`;
}

export function creditLowBalanceMessage(action: XavierActionRequest): string {
  if (action.metadata.credit_low_balance !== true) return "";
  return `\n\nAviso: seus créditos estão terminando. Você ainda tem aproximadamente ${Number(action.metadata.credit_available_after) || 0} créditos. Adicione mais quando quiser: ${getXavierCreditsUrl()}`;
}
