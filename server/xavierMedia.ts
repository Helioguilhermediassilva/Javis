import type { XavierActionAttachment, XavierActionRequest } from "./xavierTaskOrchestrator.js";
import { createXavierPresentationAttachment, createXavierTransientPresentationArtifact } from "./xavierPresentation.js";

const RUNWAY_API_BASE_URL = (process.env.RUNWAY_API_BASE_URL || "https://api.dev.runwayml.com").replace(/\/+$/, "");
const RUNWAY_API_SECRET = (process.env.RUNWAY_API_SECRET || process.env.RUNWAYML_API_SECRET || "").trim();
const RUNWAY_API_VERSION = (process.env.RUNWAY_API_VERSION || "2024-11-06").trim();
const RUNWAY_PROMPT_MAX = 1_000;
const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const BUCKET = (process.env.XAVIER_FILES_BUCKET || "xavier-files").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) || "xavier-files";
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;
const MAX_MEDIA_SIZE = 80 * 1024 * 1024;
const MAX_REFERENCE_IMAGES = 3;

const IMAGE_MODELS = new Set([
  "gen4_image",
  "gen4_image_turbo",
  "gpt_image_2",
  "gemini_image3_pro",
  "gemini_image3.1_flash",
  "seedream5_pro",
  "seedream5_lite",
  "grok_imagine_image_2",
  "gemini_2.5_flash",
]);

const VIDEO_MODELS = new Set([
  "gen4.5",
  "gen4_turbo",
  "veo3.1",
  "veo3.1_fast",
  "hailuo3",
  "happyhorse_1_0",
  "seedance2",
  "seedance2_fast",
  "seedance2_mini",
  "gemini_omni_flash",
  "seedance2_5",
  "grok_imagine_1_5",
]);

const IMAGE_RATIOS = new Set([
  "1024:1024",
  "1080:1080",
  "1168:880",
  "1360:768",
  "1440:1080",
  "1080:1440",
  "1808:768",
  "1920:1080",
  "1080:1920",
  "2112:912",
  "1280:720",
  "720:1280",
  "720:720",
  "960:720",
  "720:960",
  "1680:720",
]);

const VIDEO_RATIOS = new Set(["1280:720", "720:1280"]);

const RUNWAY_IMAGE_MODEL = normalizeImageModel(process.env.RUNWAY_IMAGE_MODEL || "gen4_image");
const RUNWAY_VIDEO_MODEL = normalizeVideoModel(process.env.RUNWAY_VIDEO_MODEL || "gen4.5");
const RUNWAY_IMAGE_RATIO = validImageRatio(process.env.RUNWAY_IMAGE_RATIO) ? process.env.RUNWAY_IMAGE_RATIO! : "1360:768";
const RUNWAY_VIDEO_RATIO = validVideoRatio(process.env.RUNWAY_VIDEO_RATIO) ? process.env.RUNWAY_VIDEO_RATIO! : "1280:720";
const RUNWAY_VIDEO_DURATION = clampDuration(Number(process.env.RUNWAY_VIDEO_DURATION || 5));

export interface XavierRunwayMediaResult {
  result_text: string;
  attachments: XavierActionAttachment[];
}

export interface XavierTransientMediaArtifact {
  file_name: string;
  bytes: Buffer;
  mime_type: string;
  size_bytes: number;
}

export interface XavierTransientVisualPresentationResult {
  result_text: string;
  artifacts: XavierTransientMediaArtifact[];
}

interface RunwayTaskResponse {
  id?: string;
  status?: string;
  output?: unknown;
  failure?: unknown;
  failureCode?: unknown;
  failureReason?: unknown;
}

function normalizeImageModel(value: string): string {
  const aliases: Record<string, string> = {
    "gen-4": "gen4_image",
    "gen-4-image-turbo": "gen4_image_turbo",
    "gpt-image-2": "gpt_image_2",
    "seedream-5": "seedream5_pro",
    "grok-imagine-image-2": "grok_imagine_image_2",
  };
  const model = aliases[value.trim()] || value.trim();
  return IMAGE_MODELS.has(model) ? model : "gen4_image";
}

function normalizeVideoModel(value: string): string {
  const aliases: Record<string, string> = {
    "gen-4.5": "gen4.5",
    "gen-4-turbo": "gen4_turbo",
    "veo-3.1": "veo3.1",
    "hailuo-3": "hailuo3",
    "seedance-2": "seedance2",
    "seedance-2-fast": "seedance2_fast",
    "seedance-2-mini": "seedance2_mini",
    "seedance-2.5": "seedance2_5",
    "grok-imagine-1.5": "grok_imagine_1_5",
    "gemini-omni-flash": "gemini_omni_flash",
  };
  const model = aliases[value.trim()] || value.trim();
  return VIDEO_MODELS.has(model) ? model : "gen4.5";
}

function validImageRatio(value: string | undefined): value is string {
  return Boolean(value && IMAGE_RATIOS.has(value));
}

function validVideoRatio(value: string | undefined): value is string {
  return Boolean(value && VIDEO_RATIOS.has(value));
}

function clampDuration(value: number): number {
  return Number.isInteger(value) ? Math.max(2, Math.min(10, value)) : 5;
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
  if (Array.isArray(value)) return value.flatMap((item) => normalizeOutputUrls(item)).slice(0, 4);
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const directValues = [record.url, record.uri, record.output, record.artifacts, record.assets, record.results];
  return Array.from(new Set(directValues.flatMap((item) => normalizeOutputUrls(item)))).slice(0, 4);
}

async function createRunwayTask(path: string, body: Record<string, unknown>): Promise<string> {
  if (!isXavierRunwayConfigured()) throw new Error("RUNWAY_API_SECRET não está configurada no projeto Xavier");
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
  const extension = input.kind === "video"
    ? (downloaded.mimeType.includes("webm") ? "webm" : "mp4")
    : downloaded.mimeType.includes("webp") ? "webp" : downloaded.mimeType.includes("jpeg") ? "jpg" : "png";
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

function imageReferencePayload(references: string[]): Array<{ uri: string; tag: string }> | undefined {
  if (!references.length) return undefined;
  return references.slice(0, MAX_REFERENCE_IMAGES).map((uri, index) => ({ uri, tag: `referencia${index + 1}` }));
}

function imageToVideoPayload(promptText: string, referenceImage: string): Record<string, unknown> {
  return {
    model: RUNWAY_VIDEO_MODEL,
    promptImage: [{ uri: referenceImage, position: "first" }],
    promptText: promptText.slice(0, RUNWAY_PROMPT_MAX),
    ratio: RUNWAY_VIDEO_RATIO,
    duration: RUNWAY_VIDEO_DURATION,
    outputFormat: "mp4",
  };
}

function textToVideoPayload(promptText: string): Record<string, unknown> {
  return {
    model: RUNWAY_VIDEO_MODEL,
    promptText: promptText.slice(0, RUNWAY_PROMPT_MAX),
    ratio: RUNWAY_VIDEO_RATIO,
    duration: RUNWAY_VIDEO_DURATION,
    outputFormat: "mp4",
  };
}

function textToImagePayload(promptText: string, references: string[]): Record<string, unknown> {
  const referenceImages = imageReferencePayload(references);
  return {
    model: RUNWAY_IMAGE_MODEL,
    promptText: promptText.slice(0, RUNWAY_PROMPT_MAX),
    ratio: RUNWAY_IMAGE_RATIO,
    ...(referenceImages ? { referenceImages } : {}),
  };
}

export async function executeXavierRunwayMediaAction(action: XavierActionRequest): Promise<XavierRunwayMediaResult> {
  if (action.kind !== "image" && action.kind !== "video") throw new Error("O executor Runway recebeu um tipo de mídia inválido");
  const references = actionReferenceImageUrls(action);
  const isVideo = action.kind === "video";
  const endpoint = isVideo && references[0] ? "/v1/image_to_video" : isVideo ? "/v1/text_to_video" : "/v1/text_to_image";
  const body = isVideo
    ? references[0] ? imageToVideoPayload(action.request_text, references[0]) : textToVideoPayload(action.request_text)
    : textToImagePayload(action.request_text, references);
  const taskId = await createRunwayTask(endpoint, body);
  const completed = await waitForRunwayTask(taskId, isVideo ? 210_000 : 100_000);
  const outputUrls = normalizeOutputUrls(completed.output);
  if (!outputUrls[0]) throw new Error("Runway concluiu a tarefa sem retornar uma URL de saída");
  const attachment = await storeMedia({ userId: action.user_id, taskId: action.id, mediaUrl: outputUrls[0], kind: action.kind });
  return {
    result_text: isVideo ? "O vídeo foi gerado pelo provedor autorizado e armazenado na sessão privada do Xavier." : "A imagem foi gerada pelo provedor autorizado e armazenada na sessão privada do Xavier.",
    attachments: [attachment],
  };
}

function mediaExtension(mimeType: string, fallback: string): string {
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  return fallback;
}

async function requestRunwayImageBytes(input: { prompt: string; referenceImages?: string[] }): Promise<{ buffer: Buffer; mimeType: string }> {
  const taskId = await createRunwayTask("/v1/text_to_image", textToImagePayload(input.prompt, input.referenceImages?.slice(0, MAX_REFERENCE_IMAGES) || []));
  const completed = await waitForRunwayTask(taskId, 100_000);
  const outputUrl = normalizeOutputUrls(completed.output)[0];
  if (!outputUrl) throw new Error("Runway concluiu a imagem sem retornar uma URL de saída");
  return downloadMedia(outputUrl);
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

export async function executeXavierTransientVisualPresentationAction(action: XavierActionRequest): Promise<XavierTransientVisualPresentationResult> {
  const references = actionReferenceImageUrls(action);
  const image = await requestRunwayImageBytes({
    prompt: `Crie uma imagem profissional para compor uma apresentação sobre: ${action.request_text}. Não inclua texto ilegível na imagem; privilegie composição visual, clareza e aparência adequada para slides.`,
    referenceImages: references,
  });
  const imageExtension = mediaExtension(image.mimeType, "png");
  const imageArtifact: XavierTransientMediaArtifact = {
    file_name: `xavier-imagem-${safePart(action.id, "visual")}.${imageExtension}`,
    bytes: image.buffer,
    mime_type: image.mimeType,
    size_bytes: image.buffer.length,
  };
  const outline = `# ${action.title}\n\n## Objetivo\n- ${action.request_text}\n\n## Direção visual\n- Imagem principal gerada por um provedor visual especializado e incorporada nesta apresentação.\n\n## Próximos passos\n- Revisar o conteúdo e adaptar os slides conforme a identidade visual desejada.`;
  const presentation = await createXavierTransientPresentationArtifact({
    title: action.title,
    outline,
    imageBuffers: [{ bytes: image.buffer, mime_type: image.mimeType }],
  });
  return {
    result_text: "A apresentação foi composta com uma imagem profissional e está pronta para ser enviada neste chat.",
    artifacts: [imageArtifact, presentation],
  };
}

export async function generateXavierRunwayImage(input: { userId: string; taskId: string; prompt: string; referenceImages?: string[] }): Promise<XavierActionAttachment> {
  const taskId = await createRunwayTask("/v1/text_to_image", textToImagePayload(input.prompt, input.referenceImages?.slice(0, MAX_REFERENCE_IMAGES) || []));
  const completed = await waitForRunwayTask(taskId, 100_000);
  const outputUrl = normalizeOutputUrls(completed.output)[0];
  if (!outputUrl) throw new Error("Runway concluiu a imagem sem retornar uma URL de saída");
  return storeMedia({ userId: input.userId, taskId: input.taskId, mediaUrl: outputUrl, kind: "image" });
}

function getSupabaseAdminKey(): string {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não está configurada no projeto Xavier");
  return key;
}
