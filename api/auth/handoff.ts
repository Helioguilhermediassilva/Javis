import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createDecipheriv, createHash } from "node:crypto";
import { getSupabaseAdminKey } from "../../server/supabaseAdmin.js";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const CALLBACK_ORIGIN = (process.env.XAVIER_PUBLIC_ORIGIN || "https://jarvisnowgo.com").replace(/\/+$/, "");
const TOKEN_VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MIN_SECRET_LENGTH = 32;

type HandoffPayload = {
  userId: string;
  tenantId: string;
  email: string;
  locale: "pt" | "en" | "es";
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function secretKey(): Buffer {
  const secret = process.env.NOWGO_XAVIER_HANDOFF_SECRET?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error("NOWGO_XAVIER_HANDOFF_SECRET não configurado corretamente");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function decryptToken(token: string): HandoffPayload {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) {
    throw new Error("handoff_invalid");
  }
  const iv = decode(parts[1]);
  const tag = decode(parts[2]);
  const encrypted = decode(parts[3]);
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || encrypted.length === 0) {
    throw new Error("handoff_invalid");
  }

  const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
  decipher.setAuthTag(tag);
  const payload = JSON.parse(
    Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"),
  ) as HandoffPayload;
  const now = Math.floor(Date.now() / 1000);
  if (
    !payload ||
    typeof payload.userId !== "string" ||
    typeof payload.tenantId !== "string" ||
    typeof payload.email !== "string" ||
    !["pt", "en", "es"].includes(payload.locale) ||
    !Number.isFinite(payload.expiresAt) ||
    payload.expiresAt < now ||
    payload.issuedAt > now + 30
  ) {
    throw new Error("handoff_expired");
  }
  return payload;
}

function callbackUrl(path: string, params: Record<string, string>): string {
  const url = new URL(path, CALLBACK_ORIGIN);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function safeErrorRedirect(res: VercelResponse, code: string): void {
  res.redirect(302, callbackUrl("/login", { handoff: code }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const rawToken = typeof req.query.token === "string" ? req.query.token : "";
    if (!rawToken) {
      safeErrorRedirect(res, "invalid");
      return;
    }
    const payload = decryptToken(rawToken);
    const adminKey = getSupabaseAdminKey();
    const redirectTo = `${CALLBACK_ORIGIN}/auth/handoff-callback`;
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        apikey: adminKey,
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        type: "magiclink",
        email: payload.email,
        redirect_to: redirectTo,
      }),
    });
    if (!response.ok) {
      throw new Error(`supabase_generate_link_${response.status}`);
    }
    const generated = (await response.json()) as { action_link?: string };
    if (!generated.action_link) throw new Error("supabase_action_link_missing");
    res.redirect(302, generated.action_link);
  } catch (error) {
    // Não devolve detalhes de configuração ou Supabase ao navegador.
    console.error("[auth.handoff] failed", error instanceof Error ? error.message : String(error));
    safeErrorRedirect(res, "unavailable");
  }
}
