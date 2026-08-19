const PLACEHOLDER_PATTERN = /service\s*role\s*key|mantida\s+somente|sua\s+chave|replace\s+me|placeholder|example/i;

export function getSupabaseAdminKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente server-side");
  }

  if (!/^[\x20-\x7E]+$/.test(key) || PLACEHOLDER_PATTERN.test(key)) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY inválida: configure a chave administrativa real do projeto Supabase no Vercel");
  }

  return key;
}

export function applySupabaseAdminHeaders(init: RequestInit = {}): Headers {
  const key = getSupabaseAdminKey();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  return headers;
}
