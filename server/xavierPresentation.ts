import { createRequire } from "node:module";
import sharp, { type Metadata } from "sharp";
import { getSupabaseAdminKey } from "./supabaseAdmin.js";

const require = createRequire(import.meta.url);
type PptxGenJsConstructor = typeof import("pptxgenjs").default;
const pptxGenJsModule = require("pptxgenjs") as PptxGenJsConstructor | { default: PptxGenJsConstructor };
const PptxGenJS = (typeof pptxGenJsModule === "function" ? pptxGenJsModule : pptxGenJsModule.default) as PptxGenJsConstructor;
type PptxGenJsInstance = InstanceType<PptxGenJsConstructor>;

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const BUCKET = (process.env.XAVIER_PRESENTATIONS_BUCKET || "xavier-presentations").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) || "xavier-presentations";
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;
const PRESENTATION_BUCKET_LIMIT_BYTES = 512 * 1024 * 1024;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_EMBED_IMAGE_BYTES = 900 * 1024;
const MAX_EMBED_IMAGE_WIDTH = 1_280;
const MAX_EMBED_IMAGE_HEIGHT = 720;
const CONFIGURED_PRESENTATION_SIZE = Number(process.env.XAVIER_PRESENTATION_APP_MAX_BYTES || 0);
const MAX_PRESENTATION_SIZE = Number.isFinite(CONFIGURED_PRESENTATION_SIZE) && CONFIGURED_PRESENTATION_SIZE > 0
  ? CONFIGURED_PRESENTATION_SIZE
  : 0;

export interface XavierGeneratedPresentationAttachment {
  file_name: string;
  url: string;
  size_bytes: number;
}

export interface XavierTransientPresentationArtifact {
  file_name: string;
  bytes: Buffer;
  mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  size_bytes: number;
}

interface PresentationSlide {
  title: string;
  bullets: string[];
}

function safeText(value: string): string {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[•·]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function storageSafePart(value: string, fallback: string): string {
  return safeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || fallback;
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

async function updateBucketLimit(): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify({ public: false, file_size_limit: PRESENTATION_BUCKET_LIMIT_BYTES }),
    signal: AbortSignal.timeout(8_000),
  });
  if (response.ok) return;
  const detail = (await response.text().catch(() => "")).slice(0, 300);
  throw new Error(`Supabase storage bucket update ${response.status}: ${detail}`);
}

async function ensureBucket(): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: PRESENTATION_BUCKET_LIMIT_BYTES }),
    signal: AbortSignal.timeout(8_000),
  });
  const detail = await response.text().catch(() => "");
  if (response.ok) return;
  if (response.status === 409) {
    await updateBucketLimit();
    return;
  }
  if (response.status === 400) {
    try {
      const payload = JSON.parse(detail) as { code?: string; message?: string; statusCode?: string | number };
      if (payload.code === "BucketAlreadyExists" || String(payload.statusCode) === "409" || /already exists|ja existe|já existe/i.test(payload.message || "")) {
        await updateBucketLimit();
        return;
      }
    } catch {
      // Mantém o erro original quando a resposta não for JSON.
    }
  }
  throw new Error(`Supabase storage bucket ${response.status}: ${detail.slice(0, 300)}`);
}

async function uploadPresentation(path: string, content: Buffer): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: new Headers({
      ...Object.fromEntries(adminHeaders("application/vnd.openxmlformats-officedocument.presentationml.presentation").entries()),
      "x-upsert": "true",
      "cache-control": "86400",
    }),
    body: content,
    signal: AbortSignal.timeout(60_000),
  });
  if (response.ok) return;
  const detail = (await response.text().catch(() => "")).slice(0, 300);
  if (response.status === 413 || /payload too large|entitytoolarge|exceeded the maximum allowed size/i.test(detail)) {
    throw new Error("O armazenamento atingiu o limite técnico deste arquivo; nenhuma cobrança foi feita");
  }
  throw new Error(`Supabase storage upload ${response.status}: ${detail}`);
}

async function removeStoredObject(path: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/remove`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ prefixes: [path] }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok && response.status !== 404) {
    console.warn("[xavier-presentation] could not remove partial object", { path, status: response.status });
  }
}

async function signedUrl(path: string): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await response.json().catch(() => ({})) as { signedURL?: string; signedUrl?: string };
  if (!response.ok) throw new Error(`Supabase storage signed URL ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`);
  const value = payload.signedURL || payload.signedUrl;
  if (!value) throw new Error("Supabase não retornou URL assinada para a apresentação");
  return value.startsWith("http") ? value : `${SUPABASE_URL}/storage/v1${value.startsWith("/") ? value : `/${value}`}`;
}

function parsePresentationOutline(outline: string, fallbackTitle: string): { title: string; slides: PresentationSlide[] } {
  const title = safeText(outline.match(/^#\s+(.+)$/m)?.[1] || fallbackTitle).slice(0, 110) || "Apresentação Xavier";
  const slides: PresentationSlide[] = [];
  let current: PresentationSlide | null = null;

  for (const rawLine of outline.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^#\s+/.test(line)) continue;
    const heading = line.match(/^#{1,3}\s*(?:slide\s*\d+\s*[:\-]?\s*)?(.+)$/i);
    if (heading) {
      if (current?.title) slides.push(current);
      current = { title: safeText(heading[1]).slice(0, 95), bullets: [] };
      continue;
    }
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (bullet && current) {
      if (current.bullets.length < 4) current.bullets.push(safeText(bullet[1]).slice(0, 220));
      continue;
    }
    if (current && current.bullets.length < 4) current.bullets.push(safeText(line).slice(0, 220));
  }
  if (current?.title) slides.push(current);

  if (slides.length) return { title, slides: slides.slice(0, 10) };

  const paragraphs = outline.split(/\n{2,}/).map((item) => safeText(item)).filter(Boolean).slice(0, 6);
  return {
    title,
    slides: paragraphs.map((paragraph, index) => ({
      title: index === 0 ? "Visão geral" : `Ponto-chave ${index + 1}`,
      bullets: [paragraph.slice(0, 220)],
    })),
  };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

async function imageBufferToDataUri(bytes: Buffer, headerType = ""): Promise<string> {
  if (!bytes.length || bytes.length > MAX_IMAGE_SIZE) throw new Error("A imagem da apresentação está vazia ou excede 8 MB");

  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, { animated: false }).metadata();
  } catch {
    throw new Error(`Formato de imagem não suportado no PPTX: ${headerType || "desconhecido"}`);
  }

  const format = metadata.format || ({
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/jpg": "jpeg",
    "image/webp": "webp",
    "image/gif": "gif",
  } as Record<string, string>)[headerType];
  if (!format || !["png", "jpeg", "webp", "gif"].includes(format)) {
    throw new Error(`Formato de imagem não suportado no PPTX: ${headerType || "desconhecido"}`);
  }

  const bounds = [
    [MAX_EMBED_IMAGE_WIDTH, MAX_EMBED_IMAGE_HEIGHT],
    [1_024, 576],
    [800, 450],
  ] as const;
  const qualities = [78, 58, 42, 30] as const;

  for (const [width, height] of bounds) {
    const resized = () => sharp(bytes, { animated: false }).resize({
      width,
      height,
      fit: "inside",
      withoutEnlargement: true,
    });
    if (metadata.hasAlpha) {
      const png = await resized().png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 76 }).toBuffer();
      if (png.length <= MAX_EMBED_IMAGE_BYTES) return `data:image/png;base64,${png.toString("base64")}`;
    }
    for (const quality of qualities) {
      const jpeg = await resized().flatten({ background: "#FFFFFF" }).jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer();
      if (jpeg.length <= MAX_EMBED_IMAGE_BYTES) return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    }
  }

  throw new Error(`A imagem otimizada da apresentação excede ${formatBytes(MAX_EMBED_IMAGE_BYTES)}`);
}

async function imageUrlToDataUri(url: string): Promise<string> {
  if (!/^https:\/\//i.test(url)) throw new Error("A imagem da apresentação precisa usar uma URL HTTPS");
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Falha ao baixar imagem da apresentação (${response.status})`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_IMAGE_SIZE) throw new Error("A imagem da apresentação excede 8 MB");
  const bytes = Buffer.from(await response.arrayBuffer());
  const headerType = (response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
  return imageBufferToDataUri(bytes, headerType);
}

function addFooter(pptx: PptxGenJsInstance, slide: ReturnType<PptxGenJsInstance["addSlide"]>, index: number): void {
  slide.addShape(pptx.ShapeType.line, { x: 0.65, y: 7.08, w: 12.0, h: 0, line: { color: "1F3A4D", width: 0.7 } });
  slide.addText("XAVIER | INTELIGÊNCIA SOBERANA", { x: 0.7, y: 7.15, w: 4.2, h: 0.18, fontFace: "Aptos", fontSize: 6.8, color: "83A3B4", margin: 0 });
  slide.addText(String(index), { x: 12.1, y: 7.15, w: 0.45, h: 0.18, fontFace: "Aptos", fontSize: 6.8, color: "83A3B4", align: "right", margin: 0 });
}

export async function renderXavierPresentationBuffer(
  title: string,
  outline: string,
  imageUrls: string[] = [],
  imageBuffers: Array<{ bytes: Buffer; mime_type?: string }> = [],
): Promise<Buffer> {
  const parsed = parsePresentationOutline(outline, title);
  const normalizedImageUrls = Array.from(new Set(imageUrls.filter((url) => /^https:\/\//i.test(url))));
  const imageData = await Promise.all([
    ...normalizedImageUrls.map((url) => imageUrlToDataUri(url)),
    ...imageBuffers.map((item) => imageBufferToDataUri(item.bytes, item.mime_type || "")),
  ]);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Xavier - Inteligência Soberana";
  pptx.company = "NOWGO";
  pptx.subject = "Apresentação gerada pelo Xavier";
  pptx.title = parsed.title;
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
  };

  const cover = pptx.addSlide();
  cover.background = { color: "071826" };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.24, h: 7.5, line: { color: "14B8A6", transparency: 100 }, fill: { color: "14B8A6" } });
  cover.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.02, w: 1.08, h: 0.08, line: { color: "14B8A6", transparency: 100 }, fill: { color: "14B8A6" } });
  cover.addText(parsed.title, { x: imageData.length ? 0.7 : 0.7, y: 1.45, w: imageData.length ? 6.7 : 10.7, h: 1.5, fontFace: "Aptos Display", fontSize: 30, bold: true, color: "FFFFFF", margin: 0, breakLine: false, fit: "shrink" });
  if (imageData[0]) cover.addImage({ data: imageData[0], x: 8.1, y: 1.05, w: 4.35, h: 4.35, transparency: 4 });
  cover.addText("Preparado por Xavier | Inteligência Soberana", { x: 0.7, y: 3.35, w: imageData.length ? 6.8 : 7.5, h: 0.32, fontFace: "Aptos", fontSize: 12.5, color: "A8C4D2", margin: 0 });
  cover.addText(new Date().toLocaleDateString("pt-BR"), { x: 0.7, y: 6.5, w: 2.5, h: 0.25, fontFace: "Aptos", fontSize: 8.5, color: "83A3B4", margin: 0 });

  parsed.slides.forEach((item, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: "F7FAFC" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.18, line: { color: "14B8A6", transparency: 100 }, fill: { color: "14B8A6" } });
    slide.addText(item.title, { x: 0.7, y: 0.65, w: imageData.length ? 7.2 : 11.7, h: 0.5, fontFace: "Aptos Display", fontSize: 24, bold: true, color: "073642", margin: 0, fit: "shrink" });
    const bullets = item.bullets.length ? item.bullets : ["Síntese preparada pelo Xavier."];
    slide.addText(
      bullets.map((text) => ({ text, options: { bullet: { indent: 18 }, hanging: 4, breakLine: true } })),
      { x: 0.9, y: 1.65, w: imageData.length ? 7.0 : 11.4, h: 4.9, fontFace: "Aptos", fontSize: 17, color: "1B3340", breakLine: false, paraSpaceAfter: 14, valign: "middle", margin: 0.04, fit: "shrink" },
    );
    // Cada imagem é incorporada no máximo uma vez no deck: a primeira na capa
    // e as seguintes nos primeiros slides. Repetir a mídia em todos os slides
    // multiplica o PPTX sem melhorar a experiência visual.
    const slideImage = index < imageData.length - 1 ? imageData[index + 1] : undefined;
    if (slideImage) slide.addImage({ data: slideImage, x: 8.35, y: 1.55, w: 4.15, h: 4.35 });
    addFooter(pptx, slide, index + 2);
  });

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(output as Buffer);
}

export async function createXavierTransientPresentationArtifact(input: {
  title: string;
  outline: string;
  imageUrls?: string[];
  imageBuffers?: Array<{ bytes: Buffer; mime_type?: string }>;
}): Promise<XavierTransientPresentationArtifact> {
  const pptx = await renderXavierPresentationBuffer(input.title, input.outline, input.imageUrls || [], input.imageBuffers || []);
  if (MAX_PRESENTATION_SIZE > 0 && pptx.length > MAX_PRESENTATION_SIZE) {
    throw new Error(`A apresentação excedeu o limite técnico transitório configurado (${formatBytes(MAX_PRESENTATION_SIZE)})`);
  }
  return {
    file_name: `${storageSafePart(input.title, "xavier-apresentacao")}.pptx`,
    bytes: pptx,
    mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    size_bytes: pptx.length,
  };
}

export async function createXavierPresentationAttachment(input: {
  userId: string;
  taskId: string;
  title: string;
  outline: string;
  imageUrls?: string[];
}): Promise<XavierGeneratedPresentationAttachment> {
  const pptx = await renderXavierPresentationBuffer(input.title, input.outline, input.imageUrls || []);
  if (MAX_PRESENTATION_SIZE > 0 && pptx.length > MAX_PRESENTATION_SIZE) {
    throw new Error(`A apresentação excedeu o limite técnico configurado (${formatBytes(MAX_PRESENTATION_SIZE)}); nenhuma cobrança foi feita`);
  }
  await ensureBucket();
  const userPart = storageSafePart(input.userId, "user");
  const taskPart = storageSafePart(input.taskId, "task");
  const path = `xavier/${userPart}/${taskPart}.pptx`;
  try {
    await uploadPresentation(path, pptx);
    return {
      file_name: `${storageSafePart(input.title, "xavier-apresentacao")}.pptx`,
      url: await signedUrl(path),
      size_bytes: pptx.length,
    };
  } catch (error) {
    await removeStoredObject(path).catch(() => undefined);
    throw error;
  }
}
