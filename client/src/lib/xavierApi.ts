import { requireSupabase } from "@/lib/supabase";

async function getAccessToken(): Promise<string> {
  const client = requireSupabase();
  const current = await client.auth.getSession();
  if (current.data.session?.access_token) return current.data.session.access_token;

  const refreshed = await client.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session?.access_token) {
    throw new Error("Sessão do Xavier ausente ou expirada. Entre novamente.");
  }
  return refreshed.data.session.access_token;
}

async function requestWithToken(path: string, init: RequestInit, accessToken: string): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(path, { ...init, headers });
}

export async function xavierApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  let accessToken = await getAccessToken();
  let response = await requestWithToken(path, init, accessToken);

  if (response.status === 401) {
    const refreshed = await requireSupabase().auth.refreshSession();
    if (!refreshed.error && refreshed.data.session?.access_token) {
      accessToken = refreshed.data.session.access_token;
      response = await requestWithToken(path, init, accessToken);
    }
  }

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Falha da API (${response.status})`);
  return payload;
}
