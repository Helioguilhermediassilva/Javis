import { requireSupabase } from "@/lib/supabase";

export async function xavierApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sessão do Xavier ausente ou expirada. Entre novamente.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Falha da API (${response.status})`);
  return payload;
}
