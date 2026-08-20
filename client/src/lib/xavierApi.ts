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

export interface XavierFileAttachment {
  file_id?: string;
  file_name: string;
  url: string;
  size_bytes?: number;
}

export interface XavierSessionFile {
  id: string;
  user_id: string;
  conversation_id: string;
  parent_file_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  category: "text" | "pdf" | "image" | "document" | "presentation" | "spreadsheet" | "archive" | "unknown";
  status: "pending" | "ready" | "failed";
  version: number;
  created_at: string;
  updated_at: string;
}

interface XavierFileUploadStart {
  file: XavierSessionFile;
  upload: { url: string; token: string; path: string };
}

export async function listXavierSessionFiles(): Promise<XavierSessionFile[]> {
  const payload = await xavierApi<{ files: XavierSessionFile[] }>("/api/xavier/files");
  return payload.files || [];
}

export async function uploadXavierSessionFile(file: File): Promise<XavierSessionFile> {
  if (file.size < 1 || file.size > 20 * 1024 * 1024) {
    throw new Error("O arquivo deve ter entre 1 byte e 20 MB.");
  }
  const started = await xavierApi<XavierFileUploadStart>("/api/xavier/files", {
    method: "POST",
    body: JSON.stringify({
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
    }),
  });

  try {
    const { error: uploadError } = await requireSupabase()
      .storage
      .from("xavier-files")
      .uploadToSignedUrl(started.upload.path, started.upload.token, file, {
        cacheControl: "86400",
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message || "Falha no armazenamento do arquivo");
    const finalized = await xavierApi<{ file: XavierSessionFile }>("/api/xavier/files", {
      method: "PATCH",
      body: JSON.stringify({ file_id: started.file.id, status: "ready" }),
    });
    return finalized.file;
  } catch (error) {
    await xavierApi<{ file: XavierSessionFile }>("/api/xavier/files", {
      method: "PATCH",
      body: JSON.stringify({ file_id: started.file.id, status: "failed" }),
    }).catch(() => undefined);
    throw error;
  }
}

export async function markXavierSessionFileFailed(fileId: string): Promise<void> {
  await xavierApi("/api/xavier/files", {
    method: "PATCH",
    body: JSON.stringify({ file_id: fileId, status: "failed" }),
  });
}

export async function getXavierSessionFileUrl(fileId: string): Promise<{ file: XavierSessionFile; url: string }> {
  return xavierApi<{ file: XavierSessionFile; url: string }>(`/api/xavier/files?file_id=${encodeURIComponent(fileId)}`);
}


/** @deprecated Use XavierFileAttachment. Mantido para compatibilidade de imports antigos. */
export type XavierManusTaskAttachment = XavierFileAttachment;

export interface XavierManusTaskStatus {
  id: string;
  status: "running" | "completed" | "failed" | "stopped";
  result_text: string | null;
  attachments: XavierFileAttachment[];
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
