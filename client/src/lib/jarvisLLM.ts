// Client for calling the JARVIS chat proxy at /api/jarvis/chat.
// O servidor usa LLM_API_KEY (somente server-side) para chamar o LLM.

import { requireSupabase } from "@/lib/supabase";

async function authenticatedHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sessão do Xavier ausente ou expirada. Entre novamente.");
  return { ...extra, Authorization: `Bearer ${data.session.access_token}` };
}

export type ChatRole = "system" | "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface AttachmentRef {
  kind: "image" | "text";
  data: string; // data URL for image; raw text excerpt for text
  name?: string;
}

export type Honorific = "senhor" | "senhora";

export interface JarvisChatOptions {
  history: ChatMessage[];
  userMessage: string;
  attachments?: AttachmentRef[];
  /** Como o XAVIER deve tratar o usuário. Injetado como system message extra. */
  honorific?: Honorific;
  /** Roteamento: auto (padrão), grok ou manus. */
  engine?: "auto" | "grok" | "manus";
  signal?: AbortSignal;
}

// ============================================================
// Streaming SSE: consome /api/jarvis/chat/stream e dispara callbacks
// ============================================================

export interface JarvisStreamEvents {
  /** Texto incremental do JARVIS. Pode ser chamado várias vezes. */
  onDelta?: (text: string) => void;
  /** Quando o LLM começa a executar uma rodada de tools. */
  onToolStart?: (names: string[]) => void;
  /** Quando as tools daquela rodada terminam. */
  onToolEnd?: (names: string[]) => void;
  /** Quando uma tarefa assíncrona Manus é criada. */
  onTaskStart?: (task: { taskId: string; manusTaskId: string; taskUrl: string | null; status: string }) => void;
  /** Arquivo gerado pelo Xavier durante o processamento. */
  onFile?: (file: { file_name: string; url: string; size_bytes?: number }) => void;
  /** Resposta final consolidada (mesmo conteúdo dos deltas concatenados). */
  onDone?: (reply: string, toolsUsed: string[]) => void;
  /** Erro fatal reportado pelo servidor durante o stream. */
  onError?: (message: string) => void;
}

export interface JarvisChatStreamOptions extends JarvisChatOptions, JarvisStreamEvents {}

/**
 * Faz POST em /api/jarvis/chat/stream e processa o stream SSE,
 * disparando callbacks granulares. Resolve com a resposta final.
 */
export async function jarvisChatStream(opts: JarvisChatStreamOptions): Promise<string> {
  const { history, userMessage, attachments, honorific, engine, signal, onDelta, onToolStart, onToolEnd, onTaskStart, onFile, onDone, onError } = opts;
  const resp = await fetch("/api/jarvis/chat/stream", {
    method: "POST",
    signal,
    headers: await authenticatedHeaders({ "Content-Type": "application/json", Accept: "text/event-stream" }),
    body: JSON.stringify({ history, userMessage, attachments, honorific, engine }),
  });
  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    const msg = `LLM stream error ${resp.status}: ${text.slice(0, 200)}`;
    onError?.(msg);
    throw new Error(msg);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  let finalReply = "";
  let toolsUsed: string[] = [];
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;
          let evt: { type: string; text?: string; names?: string[]; reply?: string; tools_used?: string[]; message?: string; task_id?: string; manus_task_id?: string; task_url?: string | null; status?: string; file_name?: string; url?: string; size_bytes?: number };
          try { evt = JSON.parse(data); } catch { continue; }
          if (evt.type === "delta" && typeof evt.text === "string") {
            onDelta?.(evt.text);
          } else if (evt.type === "tool_start" && Array.isArray(evt.names)) {
            onToolStart?.(evt.names);
          } else if (evt.type === "tool_end" && Array.isArray(evt.names)) {
            onToolEnd?.(evt.names);
          } else if (evt.type === "task_start" && evt.task_id && evt.manus_task_id) {
            onTaskStart?.({ taskId: evt.task_id, manusTaskId: evt.manus_task_id, taskUrl: evt.task_url || null, status: evt.status || "running" });
          } else if (evt.type === "file" && evt.file_name && evt.url) {
            onFile?.({ file_name: evt.file_name, url: evt.url, size_bytes: evt.size_bytes });
          } else if (evt.type === "done") {
            finalReply = (evt.reply || "").trim();
            toolsUsed = Array.isArray(evt.tools_used) ? evt.tools_used : [];
            onDone?.(finalReply, toolsUsed);
          } else if (evt.type === "error") {
            const msg = evt.message || "Stream error";
            onError?.(msg);
            throw new Error(msg);
          }
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
  return finalReply;
}

/**
 * Quebra um stream de deltas em "frases falaveis". Cada vez que detecta
 * um delimitador forte de fim de frase (. ! ? \n), emite a frase acumulada.
 * Use para alimentar o TTS à medida que o LLM gera.
 */
export function createSentenceChunker(onSentence: (s: string) => void) {
  let buf = "";
  // Limites: terminadores fortes ou parada longa de vírgulas. Mantém frases
  // mínimas de ~15 chars para evitar disparar TTS por "Sim," sozinho.
  const FLUSH_MIN = 20;
  return {
    push(text: string) {
      buf += text;
      // Procura por terminadores; emite tudo até ele, mantém o resto.
      while (true) {
        const m = buf.match(/[\.!?\n]+\s+/);
        if (!m || m.index === undefined) break;
        const end = m.index + m[0].length;
        const chunk = buf.slice(0, end).trim();
        buf = buf.slice(end);
        if (chunk.length >= FLUSH_MIN) {
          onSentence(chunk);
        } else if (chunk) {
          // Frase muito curta: agrega ao próximo buf para não disparar TTS toaà.
          buf = `${chunk} ${buf}`;
          break;
        }
      }
    },
    flush() {
      const tail = buf.trim();
      buf = "";
      if (tail) onSentence(tail);
    },
  };
}

export async function jarvisChat({ history, userMessage, attachments, honorific, engine, signal }: JarvisChatOptions): Promise<string> {
  const resp = await fetch("/api/jarvis/chat", {
    method: "POST",
    signal,
    headers: await authenticatedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ history, userMessage, attachments, honorific, engine }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`LLM error ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = (await resp.json()) as { reply?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return (data.reply ?? "").trim();
}

// ============================================================
// File → AttachmentRef helpers (run in the browser before sending)
// ============================================================

const TEXTUAL_EXTS = new Set([
  "txt", "md", "log", "csv", "json", "xml", "yaml", "yml", "ini", "toml",
  "js", "ts", "jsx", "tsx", "html", "css", "py", "java", "c", "cpp", "h", "hpp",
  "go", "rs", "rb", "php", "sh", "sql",
]);

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsText(file);
  });
}

/**
 * Convert a browser File into an AttachmentRef the server can forward to the LLM.
 *  - Images → inline data URL (multimodal vision)
 *  - Text-like files → utf-8 excerpt (truncated server-side)
 *  - Anything else → a metadata stub the model can acknowledge
 */
export async function fileToAttachment(file: File): Promise<AttachmentRef> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const isImage = file.type.startsWith("image/");
  const isText = TEXTUAL_EXTS.has(ext) || file.type.startsWith("text/");

  if (isImage) {
    // Cap image attachment to a sensible size to keep payloads small
    const MAX = 6 * 1024 * 1024; // 6MB
    if (file.size > MAX) {
      throw new Error(`Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB > 6MB)`);
    }
    const dataUrl = await readAsDataURL(file);
    return { kind: "image", data: dataUrl, name: file.name };
  }

  if (isText) {
    const MAX = 200 * 1024; // 200KB excerpt limit
    const slice = file.size > MAX ? file.slice(0, MAX) : file;
    const text = await readAsText(slice as File);
    return { kind: "text", data: text, name: file.name };
  }

  // Unknown binary: send a small metadata note so the model is aware
  const sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
  return {
    kind: "text",
    data: `Binary file, type=${file.type || "unknown"}, size=${sizeStr}. Contents not extracted client-side.`,
    name: file.name,
  };
}
