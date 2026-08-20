import { randomUUID } from "node:crypto";
import type { XavierConversation } from "./xavierMemory.js";
import { getSupabaseAdminKey } from "./supabaseAdmin.js";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const BUCKET = (process.env.XAVIER_FILES_BUCKET || "xavier-files").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) || "xavier-files";
const FILES_TABLE = `${SUPABASE_URL}/rest/v1/xavier_files`;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_READ_BYTES = 12 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

const TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/ld+json",
  "application/sql",
  "application/xml",
  "application/x-yaml",
  "application/yaml",
  "text/css",
  "text/csv",
  "text/html",
  "text/javascript",
  "text/markdown",
  "text/plain",
  "text/xml",
]);

const TEXT_EXTENSIONS = new Set([
  "c",
  "cfg",
  "conf",
  "css",
  "csv",
  "env",
  "html",
  "ini",
  "js",
  "json",
  "jsx",
  "log",
  "md",
  "mjs",
  "py",
  "rs",
  "sql",
  "sh",
  "toml",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml",
]);

export type XavierFileCategory = "text" | "pdf" | "image" | "document" | "presentation" | "spreadsheet" | "archive" | "unknown";
export type XavierFileStatus = "pending" | "ready" | "failed";

export interface XavierFileRecord {
  id: string;
  user_id: string;
  conversation_id: string;
  parent_file_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  category: XavierFileCategory;
  status: XavierFileStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface XavierFileUploadSession {
  file: XavierFileRecord;
  upload_url: string;
  upload_token: string;
  upload_path: string;
}

function adminHeaders(contentType = "application/json"): Headers {
  const key = getSupabaseAdminKey();
  return new Headers({
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Content-Type": contentType,
  });
}

async function supabaseJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: new Headers({ ...Object.fromEntries(adminHeaders().entries()), ...(init.headers || {}) }),
    signal: init.signal || AbortSignal.timeout(15_000),
  });
  const raw = await response.text().catch(() => "");
  let payload: unknown = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = raw; }
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${typeof payload === "string" ? payload.slice(0, 300) : JSON.stringify(payload).slice(0, 300)}`);
  return payload as T;
}

function normalizeFileName(value: string): string {
  const name = value.trim().replace(/[\\/\u0000-\u001f]/g, "-").replace(/\s+/g, " ").slice(0, 255);
  if (!name || name === "." || name === "..") throw new Error("Nome de arquivo inválido");
  return name;
}

function extensionOf(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]{1,12})$/);
  return match?.[1] || "";
}

function categoryOf(fileName: string, mimeType: string): XavierFileCategory {
  const mime = mimeType.toLowerCase();
  const extension = extensionOf(fileName);
  if (mime === "application/pdf" || extension === "pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("presentation") || ["ppt", "pptx", "odp"].includes(extension)) return "presentation";
  if (mime.includes("spreadsheet") || mime.includes("excel") || ["csv", "xls", "xlsx", "ods"].includes(extension)) return "spreadsheet";
  if (mime.includes("word") || mime.includes("document") || ["doc", "docx", "odt", "rtf"].includes(extension)) return "document";
  if (mime.includes("zip") || mime.includes("compressed") || ["7z", "gz", "rar", "tar", "zip"].includes(extension)) return "archive";
  if (mime.startsWith("text/") || TEXT_MIME_TYPES.has(mime) || TEXT_EXTENSIONS.has(extension)) return "text";
  return "unknown";
}

function safePathPart(value: string, fallback: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120) || fallback;
}

function storagePath(userId: string, conversationId: string, fileId: string, fileName: string): string {
  const extension = extensionOf(fileName);
  const suffix = extension ? `.${extension}` : ".bin";
  return `xavier/${safePathPart(userId, "user")}/web/${safePathPart(conversationId, "conversation")}/${safePathPart(fileId, "file")}${suffix}`;
}

function toRecord(row: Record<string, unknown>): XavierFileRecord {
  return {
    id: String(row.id || ""),
    user_id: String(row.user_id || ""),
    conversation_id: String(row.conversation_id || ""),
    parent_file_id: typeof row.parent_file_id === "string" ? row.parent_file_id : null,
    file_name: String(row.file_name || "arquivo"),
    storage_path: String(row.storage_path || ""),
    mime_type: String(row.mime_type || "application/octet-stream"),
    size_bytes: Number(row.size_bytes || 0),
    category: (["text", "pdf", "image", "document", "presentation", "spreadsheet", "archive", "unknown"] as string[]).includes(String(row.category))
      ? row.category as XavierFileCategory
      : "unknown",
    status: (["pending", "ready", "failed"] as string[]).includes(String(row.status))
      ? row.status as XavierFileStatus
      : "failed",
    version: Math.max(1, Number(row.version || 1)),
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
  };
}

async function ensureBucket(): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: MAX_FILE_BYTES }),
    signal: AbortSignal.timeout(8_000),
  });
  if (response.ok || response.status === 409) return;
  const detail = await response.text().catch(() => "");
  if (response.status === 400 && /already exists|já existe|ja existe|BucketAlreadyExists/i.test(detail)) return;
  throw new Error(`Supabase storage bucket ${response.status}: ${detail.slice(0, 300)}`);
}

async function createSignedUpload(path: string): Promise<{ url: string; token: string }> {
  const payload = await supabaseJson<{ url?: string }>(`${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
    method: "POST",
    body: "{}",
  });
  const rawUrl = payload.url || "";
  const url = rawUrl.startsWith("http") ? rawUrl : `${SUPABASE_URL}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
  const token = url ? new URL(url).searchParams.get("token") || "" : "";
  if (!url || !token) throw new Error("Supabase não retornou URL assinada para o upload");
  return { url, token };
}

async function signedDownload(path: string): Promise<string> {
  const payload = await supabaseJson<{ signedURL?: string; signedUrl?: string }>(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
  });
  const value = payload.signedURL || payload.signedUrl || "";
  if (!value) throw new Error("Supabase não retornou URL assinada para o arquivo");
  return value.startsWith("http") ? value : `${SUPABASE_URL}/storage/v1${value.startsWith("/") ? value : `/${value}`}`;
}

async function uploadObject(path: string, content: Buffer, mimeType: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: new Headers({ ...Object.fromEntries(adminHeaders(mimeType).entries()), "x-upsert": "true", "cache-control": "86400" }),
    body: content,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Supabase storage upload ${response.status}: ${(await response.text()).slice(0, 300)}`);
}

async function insertFile(row: Record<string, unknown>): Promise<XavierFileRecord> {
  const rows = await supabaseJson<Record<string, unknown>[]>(FILES_TABLE, {
    method: "POST",
    headers: new Headers({ ...Object.fromEntries(adminHeaders().entries()), Prefer: "return=representation" }),
    body: JSON.stringify(row),
  });
  if (!Array.isArray(rows) || !rows[0]) throw new Error("Registro do arquivo não foi criado");
  return toRecord(rows[0]);
}

export async function listXavierFiles(userId: string, conversationId: string): Promise<XavierFileRecord[]> {
  const params = new URLSearchParams({
    select: "id,user_id,conversation_id,parent_file_id,file_name,storage_path,mime_type,size_bytes,category,status,version,created_at,updated_at",
    user_id: `eq.${userId}`,
    conversation_id: `eq.${conversationId}`,
    status: "eq.ready",
    order: "created_at.desc",
    limit: "100",
  });
  const rows = await supabaseJson<Record<string, unknown>[]>(`${FILES_TABLE}?${params}`);
  return Array.isArray(rows) ? rows.map(toRecord) : [];
}

export async function getXavierFile(userId: string, conversationId: string, fileId: string): Promise<XavierFileRecord | null> {
  const params = new URLSearchParams({
    select: "id,user_id,conversation_id,parent_file_id,file_name,storage_path,mime_type,size_bytes,category,status,version,created_at,updated_at",
    id: `eq.${fileId}`,
    user_id: `eq.${userId}`,
    conversation_id: `eq.${conversationId}`,
    status: "eq.ready",
    limit: "1",
  });
  const rows = await supabaseJson<Record<string, unknown>[]>(`${FILES_TABLE}?${params}`);
  return Array.isArray(rows) && rows[0] ? toRecord(rows[0]) : null;
}

export async function createXavierFileUpload(input: {
  userId: string;
  conversation: XavierConversation;
  fileName: string;
  mimeType?: string;
  sizeBytes: number;
}): Promise<XavierFileUploadSession> {
  const fileName = normalizeFileName(input.fileName);
  const mimeType = (input.mimeType || "application/octet-stream").toLowerCase().slice(0, 160);
  const sizeBytes = Number(input.sizeBytes);
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES) throw new Error("Arquivo excede o limite de 20 MB ou possui tamanho inválido");
  await ensureBucket();
  const id = randomUUID();
  const path = storagePath(input.userId, input.conversation.id, id, fileName);
  const file = await insertFile({
    id,
    user_id: input.userId,
    conversation_id: input.conversation.id,
    file_name: fileName,
    storage_path: path,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    category: categoryOf(fileName, mimeType),
    status: "pending",
    version: 1,
  });
  try {
    const signed = await createSignedUpload(path);
    return { file, upload_url: signed.url, upload_token: signed.token, upload_path: path };
  } catch (error) {
    await finalizeXavierFile({ userId: input.userId, conversationId: input.conversation.id, fileId: id, status: "failed" }).catch(() => undefined);
    throw error;
  }
}

export async function finalizeXavierFile(input: {
  userId: string;
  conversationId: string;
  fileId: string;
  status: "ready" | "failed";
}): Promise<XavierFileRecord> {
  const params = new URLSearchParams({
    id: `eq.${input.fileId}`,
    user_id: `eq.${input.userId}`,
    conversation_id: `eq.${input.conversationId}`,
    select: "id,user_id,conversation_id,parent_file_id,file_name,storage_path,mime_type,size_bytes,category,status,version,created_at,updated_at",
  });
  const rows = await supabaseJson<Record<string, unknown>[]>(`${FILES_TABLE}?${params}`, {
    method: "PATCH",
    headers: new Headers({ ...Object.fromEntries(adminHeaders().entries()), Prefer: "return=representation" }),
    body: JSON.stringify({ status: input.status, updated_at: new Date().toISOString() }),
  });
  if (!Array.isArray(rows) || !rows[0]) throw new Error("Arquivo não encontrado ou não pertence à sessão atual");
  return toRecord(rows[0]);
}

export async function fileDownloadUrl(userId: string, conversationId: string, fileId: string): Promise<{ file: XavierFileRecord; url: string }> {
  const file = await getXavierFile(userId, conversationId, fileId);
  if (!file) throw new Error("Arquivo não encontrado na sessão atual");
  return { file, url: await signedDownload(file.storage_path) };
}

export async function loadXavierFileBytes(file: XavierFileRecord): Promise<Buffer> {
  const url = await signedDownload(file.storage_path);
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Não foi possível ler o arquivo (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_READ_BYTES) throw new Error("Arquivo grande demais para edição nesta sessão");
  return buffer;
}

export function isTextLikeFile(file: XavierFileRecord): boolean {
  if (["pdf", "image", "document", "presentation", "spreadsheet", "archive"].includes(file.category)) return false;
  return file.category === "text" || TEXT_MIME_TYPES.has(file.mime_type.toLowerCase()) || TEXT_EXTENSIONS.has(extensionOf(file.file_name));
}

export function isEditableXavierFile(file: XavierFileRecord): boolean {
  return isTextLikeFile(file) || file.category === "pdf" || file.mime_type === "application/pdf";
}

export function isFileEditRequest(message: string, hasActiveFile: boolean): boolean {
  if (!hasActiveFile) return false;
  const normalized = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /\b(alter|altere|alterar|edita|edite|editar|modifica|modifique|modificar|corrige|corrija|corrigir|substitua|troque|atualiza|atualize|rewrite|edit|change|modify|update|replace)\b/.test(normalized);
}

export async function loadXavierClaudeAttachment(file: XavierFileRecord): Promise<{
  kind: "image" | "text" | "document";
  data: string;
  name: string;
  mediaType?: string;
}> {
  const bytes = await loadXavierFileBytes(file);
  if (file.category === "image" && /^image\/(jpeg|png|gif|webp)$/i.test(file.mime_type)) {
    return { kind: "image", data: `data:${file.mime_type};base64,${bytes.toString("base64")}`, name: file.file_name };
  }
  if (file.category === "pdf" || file.mime_type === "application/pdf") {
    return { kind: "document", data: bytes.toString("base64"), name: file.file_name, mediaType: "application/pdf" };
  }
  if (isTextLikeFile(file)) {
    return { kind: "text", data: bytes.toString("utf8").slice(0, 12_000), name: file.file_name };
  }
  return {
    kind: "text",
    data: `[Arquivo ${file.file_name} recebido e armazenado na sessão. O formato ${file.mime_type} não possui edição binária automática nesta etapa; preserve o arquivo original e explique o que precisa ser convertido.]`,
    name: file.file_name,
  };
}

function versionedFileName(fileName: string, version: number, extension = extensionOf(fileName)): string {
  const base = fileName.replace(/\.[^.]+$/, "").slice(0, 220) || "arquivo";
  const suffix = extension ? `.${extension}` : "";
  return `${base}-v${version}${suffix}`;
}

async function createVersionRecord(input: {
  source: XavierFileRecord;
  content: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<XavierFileRecord> {
  if (input.content.length > MAX_FILE_BYTES) throw new Error("A versão editada excede o limite de 20 MB");
  const id = randomUUID();
  const path = storagePath(input.source.user_id, input.source.conversation_id, id, input.fileName);
  await uploadObject(path, input.content, input.mimeType);
  return insertFile({
    id,
    user_id: input.source.user_id,
    conversation_id: input.source.conversation_id,
    parent_file_id: input.source.id,
    file_name: input.fileName,
    storage_path: path,
    mime_type: input.mimeType,
    size_bytes: input.content.length,
    category: categoryOf(input.fileName, input.mimeType),
    status: "ready",
    version: input.source.version + 1,
  });
}

export async function persistEditedXavierFile(input: {
  source: XavierFileRecord;
  content: string;
}): Promise<{ file: XavierFileRecord; url: string }> {
  const isPdf = input.source.category === "pdf" || input.source.mime_type === "application/pdf";
  const content = Buffer.from(input.content, "utf8");
  const fileName = isPdf ? versionedFileName(input.source.file_name, input.source.version + 1, "md") : versionedFileName(input.source.file_name, input.source.version + 1);
  const mimeType = isPdf ? "text/markdown" : (input.source.mime_type || "text/plain");
  const file = await createVersionRecord({ source: input.source, content, fileName, mimeType });
  return { file, url: await signedDownload(file.storage_path) };
}
