import { createRequire } from "node:module";
import { getSupabaseAdminKey } from "./supabaseAdmin.js";

const require = createRequire(import.meta.url);
type PptxGenJsConstructor = typeof import("pptxgenjs").default;
const pptxGenJsModule = require("pptxgenjs") as PptxGenJsConstructor | { default: PptxGenJsConstructor };
const PptxGenJS = (typeof pptxGenJsModule === "function" ? pptxGenJsModule : pptxGenJsModule.default) as PptxGenJsConstructor;
type PptxGenJsInstance = InstanceType<PptxGenJsConstructor>;

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const BUCKET = (process.env.XAVIER_FILES_BUCKET || "xavier-files").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) || "xavier-files";
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export interface XavierGeneratedPresentationAttachment {
  file_name: string;
  url: string;
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

async function ensureBucket(): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: MAX_FILE_SIZE }),
    signal: AbortSignal.timeout(8_000),
  });
  const detail = await response.text().catch(() => "");
  if (response.ok || response.status === 409) return;
  if (response.status === 400) {
    try {
      const payload = JSON.parse(detail) as { code?: string; message?: string; statusCode?: string | number };
      if (payload.code === "BucketAlreadyExists" || String(payload.statusCode) === "409" || /already exists|ja existe|já existe/i.test(payload.message || "")) return;
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
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Supabase storage upload ${response.status}: ${(await response.text()).slice(0, 300)}`);
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

function addFooter(pptx: PptxGenJsInstance, slide: ReturnType<PptxGenJsInstance["addSlide"]>, index: number): void {
  slide.addShape(pptx.ShapeType.line, { x: 0.65, y: 7.08, w: 12.0, h: 0, line: { color: "1F3A4D", width: 0.7 } });
  slide.addText("XAVIER | INTELIGÊNCIA SOBERANA", { x: 0.7, y: 7.15, w: 4.2, h: 0.18, fontFace: "Aptos", fontSize: 6.8, color: "83A3B4", margin: 0 });
  slide.addText(String(index), { x: 12.1, y: 7.15, w: 0.45, h: 0.18, fontFace: "Aptos", fontSize: 6.8, color: "83A3B4", align: "right", margin: 0 });
}

export async function renderXavierPresentationBuffer(title: string, outline: string): Promise<Buffer> {
  const parsed = parsePresentationOutline(outline, title);
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
  cover.addText(parsed.title, { x: 0.7, y: 1.45, w: 10.7, h: 1.5, fontFace: "Aptos Display", fontSize: 30, bold: true, color: "FFFFFF", margin: 0, breakLine: false, fit: "shrink" });
  cover.addText("Preparado por Xavier | Inteligência Soberana", { x: 0.7, y: 3.35, w: 7.5, h: 0.32, fontFace: "Aptos", fontSize: 12.5, color: "A8C4D2", margin: 0 });
  cover.addText(new Date().toLocaleDateString("pt-BR"), { x: 0.7, y: 6.5, w: 2.5, h: 0.25, fontFace: "Aptos", fontSize: 8.5, color: "83A3B4", margin: 0 });

  parsed.slides.forEach((item, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: "F7FAFC" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.18, line: { color: "14B8A6", transparency: 100 }, fill: { color: "14B8A6" } });
    slide.addText(item.title, { x: 0.7, y: 0.65, w: 11.7, h: 0.5, fontFace: "Aptos Display", fontSize: 24, bold: true, color: "073642", margin: 0, fit: "shrink" });
    const bullets = item.bullets.length ? item.bullets : ["Síntese preparada pelo Xavier."];
    slide.addText(
      bullets.map((text) => ({ text, options: { bullet: { indent: 18 }, hanging: 4, breakLine: true } })),
      { x: 0.9, y: 1.65, w: 11.4, h: 4.9, fontFace: "Aptos", fontSize: 17, color: "1B3340", breakLine: false, paraSpaceAfter: 14, valign: "middle", margin: 0.04, fit: "shrink" },
    );
    addFooter(pptx, slide, index + 2);
  });

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(output as Buffer);
}

export async function createXavierPresentationAttachment(input: {
  userId: string;
  taskId: string;
  title: string;
  outline: string;
}): Promise<XavierGeneratedPresentationAttachment> {
  const pptx = await renderXavierPresentationBuffer(input.title, input.outline);
  if (pptx.length > MAX_FILE_SIZE) throw new Error("Apresentação gerada excede o limite de 20 MB");
  await ensureBucket();
  const userPart = storageSafePart(input.userId, "user");
  const taskPart = storageSafePart(input.taskId, "task");
  const path = `xavier/${userPart}/${taskPart}.pptx`;
  await uploadPresentation(path, pptx);
  return {
    file_name: `${storageSafePart(input.title, "xavier-apresentacao")}.pptx`,
    url: await signedUrl(path),
    size_bytes: pptx.length,
  };
}
