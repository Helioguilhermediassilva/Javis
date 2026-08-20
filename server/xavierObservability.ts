import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

export type XavierEventLevel = "info" | "warn" | "error";

function normalizeErrorMessage(value: unknown): string {
  return String(value || "")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(sk|xai|key|token|secret)[-_ ]?[A-Za-z0-9]{12,}/gi, "$1-[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function getXavierRequestId(req?: IncomingMessage): string {
  const header = req?.headers?.["x-request-id"];
  const candidate = Array.isArray(header) ? header[0] : header;
  return typeof candidate === "string" && /^[A-Za-z0-9._:-]{8,120}$/.test(candidate)
    ? candidate
    : randomUUID();
}

export function logXavierEvent(
  level: XavierEventLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const safeFields = Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        key === "error" || key === "message" ? normalizeErrorMessage(value) : value,
      ]),
  );
  const record = JSON.stringify({
    service: "xavier",
    level,
    event,
    timestamp: new Date().toISOString(),
    ...safeFields,
  });
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}

export function publicXavierError(status: number, message: unknown): string {
  const candidate = String(message || "").trim();
  if (status >= 500 || /upstream|network error|supabase|storage|telegram|anthropic|xai|elevenlabs|claude|invalid upstream|empty reply|provider|fetch failed/i.test(candidate)) {
    return "O Xavier encontrou uma falha temporária. Tente novamente em alguns instantes.";
  }
  if (!candidate) return "Não foi possível concluir a solicitação.";
  return candidate.slice(0, 240);
}
