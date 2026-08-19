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

export interface XavierManusTaskStatus {
  id: string;
  status: "running" | "completed" | "failed" | "stopped";
  result_text: string | null;
  error_message: string | null;
  task_url: string | null;
  updated_at: string;
  completed_at: string | null;
}

export async function getXavierManusTask(taskId: string): Promise<XavierManusTaskStatus> {
  const payload = await xavierApi<{ task: XavierManusTaskStatus }>(`/api/xavier/manus?task_id=${encodeURIComponent(taskId)}`);
  return payload.task;
}

export async function waitForXavierManusTask(
  taskId: string,
  onUpdate?: (task: XavierManusTaskStatus) => void,
  options: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<XavierManusTaskStatus> {
  const intervalMs = options.intervalMs ?? 5_000;
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (options.signal?.aborted) throw new DOMException("Polling cancelado", "AbortError");
    const task = await getXavierManusTask(taskId);
    onUpdate?.(task);
    if (["completed", "failed", "stopped"].includes(task.status)) return task;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, intervalMs);
      options.signal?.addEventListener("abort", () => {
        window.clearTimeout(timer);
        reject(new DOMException("Polling cancelado", "AbortError"));
      }, { once: true });
    });
  }
  throw new Error("A tarefa Manus excedeu o tempo de acompanhamento no cockpit.");
}
