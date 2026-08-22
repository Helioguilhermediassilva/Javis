import PDFDocument from "pdfkit";
import { getSupabaseAdminKey } from "./supabaseAdmin.js";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const BUCKET = (process.env.XAVIER_FILES_BUCKET || "xavier-files").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) || "xavier-files";
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

export interface XavierGeneratedPdfAttachment {
  file_name: string;
  url: string;
  size_bytes: number;
}

export interface XavierTransientPdfArtifact {
  file_name: string;
  bytes: Buffer;
  mime_type: "application/pdf";
  size_bytes: number;
}

function adminHeaders(contentType = "application/json"): Headers {
  const key = getSupabaseAdminKey();
  const headers = new Headers({
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Content-Type": contentType,
  });
  return headers;
}

function pdfSafeText(value: string): string {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[•·]/g, "-")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function pdfFileName(title: string): string {
  return `${pdfSafeText(title).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "xavier-documento"}.pdf`;
}

function renderPdfBuffer(title: string, body: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      margin: 54,
      info: {
        Title: pdfSafeText(title),
        Author: "Xavier - Inteligencia Soberana",
        Subject: "Documento gerado pelo Xavier",
      },
    });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.font("Helvetica-Bold").fontSize(18).fillColor("#073642").text(pdfSafeText(title), { align: "left" });
    document.moveDown(0.6);
    document.font("Helvetica").fontSize(9).fillColor("#586e75").text("XAVIER | INTELIGENCIA SOBERANA");
    document.moveDown(1.2);

    const paragraphs = pdfSafeText(body).split(/\n{2,}/g);
    for (const paragraph of paragraphs) {
      const lines = paragraph.split(/\n/g).map((line) => line.trim()).filter(Boolean);
      if (!lines.length) continue;
      document.font("Helvetica").fontSize(11).fillColor("#111111").text(lines.join("\n"), {
        align: "left",
        lineGap: 4,
        paragraphGap: 10,
      });
      document.moveDown(0.4);
    }

    document.moveDown(1);
    document.font("Helvetica").fontSize(8).fillColor("#586e75").text(`Gerado em ${new Date().toLocaleString("pt-BR")}`);
    document.end();
  });
}

async function ensureBucket(): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: 20 * 1024 * 1024 }),
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

function storagePath(userId: string, taskId: string): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100) || "user";
  const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 160) || "task";
  return `xavier/${safeUserId}/${safeTaskId}.pdf`;
}

async function uploadPdf(path: string, content: Buffer): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: new Headers({
      ...Object.fromEntries(adminHeaders("application/pdf").entries()),
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
  if (!value) throw new Error("Supabase não retornou URL assinada para o PDF");
  return value.startsWith("http") ? value : `${SUPABASE_URL}/storage/v1${value.startsWith("/") ? value : `/${value}`}`;
}

export async function createXavierTransientPdfArtifact(input: {
  title: string;
  body: string;
}): Promise<XavierTransientPdfArtifact> {
  const pdf = await renderPdfBuffer(input.title, input.body);
  if (pdf.length > 20 * 1024 * 1024) throw new Error("PDF gerado excede o limite transitório de 20 MB");
  return {
    file_name: pdfFileName(input.title),
    bytes: pdf,
    mime_type: "application/pdf",
    size_bytes: pdf.length,
  };
}

export async function createXavierPdfAttachment(input: {
  userId: string;
  taskId: string;
  title: string;
  body: string;
}): Promise<XavierGeneratedPdfAttachment> {
  const pdf = await renderPdfBuffer(input.title, input.body);
  if (pdf.length > 20 * 1024 * 1024) throw new Error("PDF gerado excede o limite de 20 MB");
  await ensureBucket();
  const path = storagePath(input.userId, input.taskId);
  await uploadPdf(path, pdf);
  return {
    file_name: pdfFileName(input.title),
    url: await signedUrl(path),
    size_bytes: pdf.length,
  };
}
