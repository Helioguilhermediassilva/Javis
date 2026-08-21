import { getSupabaseAdminKey } from "./supabaseAdmin.js";
import type { XavierActionAttachment, XavierActionRequest } from "./xavierTaskOrchestrator.js";
import { createXavierPresentationAttachment } from "./xavierPresentation.js";

const RUNWAY_API_BASE_URL = (process.env.RUNWAY_API_BASE_URL || "https://api.dev.runwayml.com").replace(/\/+$/, "");
const RUNWAY_API_SECRET = (process.env.RUNWAYML_API_SECRET || process.env.RUNWAY_API_SECRET || "").trim();
const RUNWAY_API_VERSION = process.env.RUNWAY_API_VERSION || "2024-11-06";
const RUNWAY_IMAGE_MODEL = process.env.RUNWAY_IMAGE_MODEL || "gen4_image";
const RUNWAY_VIDEO_MODEL = process.env.RUNWAY_VIDEO_MODEL || "gen4.5";
const RUNWAY_IMAGE_RATIO = process.env.RUNWAY_IMAGE_RATIO || "1920:1080";
const RUNWAY_VIDEO_RATIO = process.env.RUNWAY_VIDEO_RATIO || "1280:768";
const RUNWAY_VIDEO_DURATION = Math.max(5, Math.min(10, Number(process.env.RUNWAY_VIDEO_DURATION || 5)));
const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const BUCKET = (process.env.XAVIER_FILES_BUCKET || "xavier-files").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) || "xavier-files";
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;
const MAX_MEDIA_SIZE = 80 * 1024 * 1024;
const MAX_REFERENCE_IMAGES = 4;

export interface XavierRunwayMediaResult {
  result_text: string;
  attachments: XavierActionAttachment[];
}

interface RunwayTaskResponse {
  id?: string;
  status?: string;
  output?: unknown;
  failure?: unknown;
  failureCode?: unknown;
  failureReason?: unknown;
}

function safePart(value: string, fallback: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;
}

function runwayHeaders(): Headers {
  return new Headers({
    Authorization: `Bearer ${RUNWAY_API_SECRET}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Runway-Version": RUNWAY_API_VERSION,
  });
}

export function isXavierRunwayConfigured(): boolean {
  return Boolean(RUNWAY_API_SECRET);
}

export function extractXavierReferenceImageUrls(text: string): string[] {
  const matches = text.match(/https:\/\/[^\s)\]}>'"]+/gi) || [];
  return Array.from(new Set(matches.map((url) => url.replace(/[.,;:!?]+$/, "")).filter((url) => /^https:\/\//i.test(url)))).slice(0, MAX_REFERENCE_IMAGES);
}

function actionReferenceImageUrls(action: XavierActionRequest): string[] {
  const metadataUrls = Array.isArray(action.metadata.reference_image_urls) ? action.metadata.reference_image_urls : [];
  const safeMetadataUrls = metadataUrls.filter((value): value is string => typeof value === "string" && /^https:\/\//i.test(value));
  return Array.from(new Set([...safeMetadataUrls, ...extractXavierReferenceImageUrls(action.request_text)])).slice(0, MAX_REFERENCE_IMAGES);
}

function normalizeOutputUrls(value: unknown): string[] {
  if (typeof value === "string") return /^https:\/\//i.test(value) ? [value] : [];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => normalizeOutputUrls(item)).slice(0, 4);
}

async function createRunwayTask(path: string, body: Record<string, unknown>): Promise<string> {
  if (!isXavierRunwayConfigured()) throw new Error("RUNWAYML_API_SECRET não está configurada no projeto Xavier");
  const response = await fetch(`${RUNWAY_API_BASE_URL}${path}`, {
    method: "POST",
    headers: runwayHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({})) as RunwayTaskResponse & { error?: string; message?: string };
  if (!response.ok || !payload.id) {
    throw new Error(`Runway ${response.status}: ${String(payload.message || payload.error || "não retornou o ID da tarefa").slice(0, 400)}`);
  }
  return payload.id;
}

async function waitForRunwayTask(taskId: string, timeoutMs: number): Promise<RunwayTaskResponse> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "PENDING";
  while (Date.now() < deadline) {
    const response = await fetch(`${RUNWAY_API_BASE_URL}/v1/tasks/${encodeURIComponent(taskId)}`, {
      headers: runwayHeaders(),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({})) as RunwayTaskResponse & { message?: string };
    if (!response.ok) throw new Error(`Runway task ${response.status}: ${String(payload.message || "falha ao consultar a tarefa").slice(0, 400)}`);
    lastStatus = String(payload.status || lastStatus).toUpperCase();
    if (lastStatus === "SUCCEEDED") return payload;
    if (["FAILED", "CANCELED", "CANCELLED"].includes(lastStatus)) {
      throw new Error(`Runway não concluiu a mídia: ${String(payload.failureReason || payload.failure || lastStatus).slice(0, 500)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  throw new Error(`Runway excedeu o tempo de espera; último estado: ${lastStatus}`);
}

async function downloadMedia(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!/^https:\/\//i.test(url)) throw new Error("O provedor retornou uma URL de mídia não HTTPS");
  const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`Download de mídia ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_MEDIA_SIZE) throw new Error("A mídia retornada excede o limite de armazenamento do Xavier");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_MEDIA_SIZE) throw new Error("A mídia retornada está vazia ou excede o limite de armazenamento");
  const mimeType = (response.headers.get("content-type") || "application/octet-stream").split(";", 1)[0].toLowerCase();
  return { buffer, mimeType };
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

async function ensureBucket(): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: MAX_MEDIA_SIZE }),
    signal: AbortSignal.timeout(8_000),
  });
  if (response.ok || response.status === 409) return;
  const detail = await response.text().catch(() => "");
  if (response.status === 400 && /already exists|ja existe|já existe/i.test(detail)) return;
  throw new Error(`Supabase storage bucket ${response.status}: ${detail.slice(0, 300)}`);
}

async function storeMedia(input: {
  userId: string;
  taskId: string;
  mediaUrl: string;
  kind: "image" | "video";
}): Promise<XavierActionAttachment> {
  const downloaded = await downloadMedia(input.mediaUrl);
  const extension = input.kind === "video" ? (downloaded.mimeType.includes("webm") ? "webm" : "mp4") : downloaded.mimeType.includes("webp") ? "webp" : downloaded.mimeType.includes("jpeg") ? "jpg" : "png";
  await ensureBucket();
  const path = `xavier/${safePart(input.userId, "user")}/media-${safePart(input.taskId, "task")}.${extension}`;
  const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: new Headers({
      ...Object.fromEntries(adminHeaders(downloaded.mimeType).entries()),
      "x-upsert": "true",
      "cache-control": "86400",
    }),
    body: downloaded.buffer,
    signal: AbortSignal.timeout(30_000),
  });
  if (!upload.ok) throw new Error(`Supabase media upload ${upload.status}: ${(await upload.text()).slice(0, 300)}`);
  const signed = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    signal: AbortSignal.timeout(8_000),
  });
  const signedPayload = await signed.json().catch(() => ({})) as { signedURL?: string; signedUrl?: string };
  if (!signed.ok) throw new Error(`Supabase media signed URL ${signed.status}`);
  const signedPath = signedPayload.signedURL || signedPayload.signedUrl;
  if (!signedPath) throw new Error("Supabase não retornou URL assinada da mídia");
  const url = signedPath.startsWith("http") ? signedPath : `${SUPABASE_URL}/storage/v1${signedPath.startsWith("/") ? signedPath : `/${signedPath}`}`;
  return { file_name: `${input.kind === "video" ? "xavier-video" : "xavier-imagem"}-${safePart(input.taskId, "arquivo")}.${extension}`, url, size_bytes: downloaded.buffer.length, mime_type: downloaded.mimeType };
}

export async function executeXavierRunwayMediaAction(action: XavierActionRequest): Promise<XavierRunwayMediaResult> {
  if (action.kind !== "image" && action.kind !== "video") throw new Error("O executor Runway recebeu um tipo de mídia inválido");
  const references = actionReferenceImageUrls(action);
  const isVideo = action.kind === "video";
  const taskId = await createRunwayTask(isVideo ? "/v1/image_to_video" : "/v1/text_to_image", isVideo
    ? {
      model: RUNWAY_VIDEO_MODEL,
      promptText: action.request_text.slice(0, 1_500),
      ...(references[0] ? { promptImage: references[0] } : {}),
      ratio: RUNWAY_VIDEO_RATIO,
      duration: RUNWAY_VIDEO_DURATION,
    }
    : {
      model: RUNWAY_IMAGE_MODEL,
      promptText: action.request_text.slice(0, 1_500),
      ratio: RUNWAY_IMAGE_RATIO,
      ...(references.length ? { referenceImages: references.map((uri, index) => ({ uri, tag: `referencia${index + 1}` })) } : {}),
    });
  const completed = await waitForRunwayTask(taskId, isVideo ? 210_000 : 100_000);
  const outputUrls = normalizeOutputUrls(completed.output);
  if (!outputUrls[0]) throw new Error("Runway concluiu a tarefa sem retornar uma URL de saída");
  const attachment = await storeMedia({ userId: action.user_id, taskId: action.id, mediaUrl: outputUrls[0], kind: action.kind });
  return {
    result_text: isVideo ? "O vídeo foi gerado pelo provedor autorizado e armazenado na sessão privada do Xavier." : "A imagem foi gerada pelo provedor autorizado e armazenada na sessão privada do Xavier.",
    attachments: [attachment],
  };
}

export async function executeXavierVisualPresentationAction(action: XavierActionRequest): Promise<XavierRunwayMediaResult> {
  const references = actionReferenceImageUrls(action);
  const image = await generateXavierRunwayImage({
    userId: action.user_id,
    taskId: `${action.id}-visual`,
    prompt: `Crie uma imagem profissional para compor uma apresentação sobre: ${action.request_text}. Não inclua texto ilegível na imagem; privilegie composição visual, clareza e aparência adequada para slides.`,
    referenceImages: references,
  });
  const presentation = await createXavierPresentationAttachment({
    userId: action.user_id,
    taskId: action.id,
    title: action.title,
    outline: `# ${action.title}\n\n## Objetivo\n- ${action.request_text}\n\n## Direção visual\n- Imagem principal gerada por um provedor visual especializado e incorporada nesta apresentação.\n\n## Próximos passos\n- Revisar o conteúdo e adaptar os slides conforme a identidade visual desejada.`,
    imageUrls: [image.url],
  });
  return {
    result_text: "A imagem foi gerada e incorporada dentro da apresentação. Os dois arquivos foram armazenados na sessão privada do Xavier.",
    attachments: [image, presentation],
  };
}

export async function generateXavierRunwayImage(input: { userId: string; taskId: string; prompt: string; referenceImages?: string[] }): Promise<XavierActionAttachment> {
  const taskId = await createRunwayTask("/v1/text_to_image", {
    model: RUNWAY_IMAGE_MODEL,
    promptText: input.prompt.slice(0, 1_500),
    ratio: RUNWAY_IMAGE_RATIO,
    ...(input.referenceImages?.length ? { referenceImages: input.referenceImages.slice(0, MAX_REFERENCE_IMAGES).map((uri, index) => ({ uri, tag: `referencia${index + 1}` })) } : {}),
  });
  const completed = await waitForRunwayTask(taskId, 100_000);
  const outputUrl = normalizeOutputUrls(completed.output)[0];
  if (!outputUrl) throw new Error("Runway concluiu a imagem sem retornar uma URL de saída");
  return storeMedia({ userId: input.userId, taskId: input.taskId, mediaUrl: outputUrl, kind: "image" });
}
