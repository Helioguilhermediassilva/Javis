import type { IncomingMessage } from "node:http";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");

function getAuthApiKey(): string {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SECRET_KEY
    || "";
  if (!key) throw new XavierAuthError(500, "Chave pública do Supabase não configurada");
  return key;
}

function getAuthorization(req: IncomingMessage): string {
  const value = req.headers.authorization;
  const header = Array.isArray(value) ? value[0] || "" : value || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export interface XavierUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export class XavierAuthError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "XavierAuthError";
  }
}

export async function requireXavierUser(req: IncomingMessage): Promise<XavierUser> {
  const accessToken = getAuthorization(req);
  if (!accessToken) throw new XavierAuthError(401, "Autenticação necessária");

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      // A chave pública identifica a aplicação; o Bearer identifica o usuário.
      // A service role permanece reservada para operações administrativas do backend.
      apikey: getAuthApiKey(),
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      console.warn("Xavier auth rejected access token", { status: response.status });
      throw new XavierAuthError(401, "Sessão inválida ou expirada");
    }
    console.error("Xavier auth validation failed", { status: response.status });
    throw new XavierAuthError(502, `Falha ao validar sessão (${response.status})`);
  }

  const user = (await response.json().catch(() => null)) as XavierUser | null;
  if (!user?.id || typeof user.id !== "string") {
    throw new XavierAuthError(401, "Resposta de autenticação inválida");
  }
  return user;
}

export function authErrorResponse(error: unknown): { status: number; message: string } | null {
  if (error instanceof XavierAuthError) return { status: error.status, message: error.message };
  return null;
}
