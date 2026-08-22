import { getSupabaseAdminKey } from "./supabaseAdmin.js";
import type { ClaudeGeneratedFile, ClaudeHistoryMessage } from "./xavierClaude.js";
import { appendClaudeCitations, generateClaudeReply, XAVIER_CLAUDE_SYSTEM_PROMPT } from "./xavierClaude.js";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const BUCKET = (process.env.XAVIER_FILES_BUCKET || "xavier-files").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) || "xavier-files";
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

type OfficeKind = "document" | "spreadsheet" | "image";

export interface XavierGeneratedOfficeAttachment {
  file_name: string;
  url: string;
  size_bytes: number;
  kind: OfficeKind;
}

export interface XavierTransientOfficeArtifact {
  file_name: string;
  bytes: Buffer;
  mime_type: string;
  size_bytes: number;
  kind: OfficeKind;
}

function safe(value: string, fallback = "xavier-arquivo"): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 100) || fallback;
}

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc ^= data[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Buffer { const b = Buffer.alloc(2); b.writeUInt16LE(value, 0); return b; }
function u32(value: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32LE(value >>> 0, 0); return b; }

function zipStore(entries: Array<{ name: string; content: string | Buffer }>): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content, "utf8");
    const header = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc32(data)), u32(data.length), u32(data.length), u16(name.length), u16(0), name]);
    local.push(header, data);
    const directory = Buffer.concat([Buffer.from([0x50, 0x4b, 0x01, 0x02]), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc32(data)), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]);
    central.push(directory);
    offset += header.length + data.length;
  }
  const centralData = Buffer.concat(central);
  const end = Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralData.length), u32(offset), u16(0)]);
  return Buffer.concat([...local, centralData, end]);
}

function officeContent(input: { kind: OfficeKind; title: string; requestText: string; content: string }): string {
  if (input.kind === "spreadsheet") {
    return input.content.trim() || `Item;Detalhe\n${input.title};${input.requestText}`;
  }
  return input.content.trim() || input.requestText.trim() || input.title;
}

function renderDocx(title: string, body: string): Buffer {
  const paragraphs = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 250);
  const bodyXml = paragraphs.map((line) => {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const text = heading ? heading[2] : line.replace(/^[-*]\s+/, "• ");
    const size = heading ? (heading[1].length === 1 ? 32 : 25) : 22;
    return `<w:p><w:pPr>${heading ? `<w:spacing w:after="160"/><w:keepNext/>` : `<w:spacing w:after="100"/>`}</w:pPr><w:r><w:rPr><w:sz w:val="${size}"/>${heading ? "<w:b/>" : ""}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
  }).join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="300"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>${xml(title)}</w:t></w:r></w:p>${bodyXml}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:right="1200" w:bottom="1200" w:left="1200"/></w:sectPr></w:body></w:document>`;
  return zipStore([
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: "word/document.xml", content: document },
    { name: "word/styles.xml", content: `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>` },
    { name: "word/_rels/document.xml.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>` },
  ]);
}

function renderXlsx(title: string, body: string): Buffer {
  const rows = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 1000).map((line) => line.split(/\t|;|,(?=\s*[^\d])/).map((cell) => cell.trim()).slice(0, 24));
  if (!rows.length) rows.push([title]);
  const sheetRows = rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => `<c r="${String.fromCharCode(65 + Math.min(c, 25))}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(cell)}</t></is></c>`).join("")}</row>`).join("");
  return zipStore([
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(title.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { name: "xl/worksheets/sheet1.xml", content: `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>` },
  ]);
}

function renderSvg(title: string, body: string): Buffer {
  const lines = body.replace(/[#*_`]/g, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
  const text = lines.map((line, index) => `<text x="72" y="${180 + index * 42}" fill="#eaf2f8" font-family="Arial, sans-serif" font-size="${index === 0 ? 26 : 18}">${xml(line.slice(0, 90))}</text>`).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071826"/><stop offset="1" stop-color="#116466"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><rect x="48" y="48" width="1504" height="804" rx="28" fill="#071826" fill-opacity=".45" stroke="#14b8a6" stroke-width="3"/><text x="72" y="110" fill="#14b8a6" font-family="Arial, sans-serif" font-size="18">XAVIER | INTELIGÊNCIA SOBERANA</text><text x="72" y="155" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="700">${xml(title.slice(0, 80))}</text>${text}</svg>`, "utf8");
}

function adminHeaders(contentType = "application/json"): Headers {
  const key = getSupabaseAdminKey();
  return new Headers({ apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": contentType });
}

async function ensureBucket(): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, { method: "POST", headers: adminHeaders(), body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: MAX_FILE_SIZE }), signal: AbortSignal.timeout(8_000) });
  const detail = await response.text().catch(() => "");
  if (response.ok || response.status === 409 || /already exists|ja existe|já existe/i.test(detail)) return;
  throw new Error(`Supabase storage bucket ${response.status}: ${detail.slice(0, 300)}`);
}

async function upload(path: string, data: Buffer, contentType: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: new Headers({ ...Object.fromEntries(adminHeaders(contentType).entries()), "x-upsert": "true", "cache-control": "86400" }), body: data, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Supabase storage upload ${response.status}: ${(await response.text()).slice(0, 300)}`);
}

async function signedUrl(path: string): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`, { method: "POST", headers: adminHeaders(), body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }), signal: AbortSignal.timeout(8_000) });
  const payload = await response.json().catch(() => ({})) as { signedURL?: string; signedUrl?: string };
  if (!response.ok) throw new Error(`Supabase storage signed URL ${response.status}`);
  const value = payload.signedURL || payload.signedUrl;
  if (!value) throw new Error("Supabase não retornou URL assinada para o artefato");
  return value.startsWith("http") ? value : `${SUPABASE_URL}/storage/v1${value.startsWith("/") ? value : `/${value}`}`;
}

async function createStoredBuffer(input: { userId: string; taskId: string; title: string; kind: OfficeKind; buffer: Buffer; fileName?: string; contentType?: string }): Promise<XavierGeneratedOfficeAttachment> {
  if (input.buffer.length > MAX_FILE_SIZE) throw new Error("Artefato gerado excede o limite de 20 MB");
  const extension = input.kind === "document" ? "docx" : input.kind === "spreadsheet" ? "xlsx" : "svg";
  const contentType = input.contentType || (input.kind === "document" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : input.kind === "spreadsheet" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "image/svg+xml");
  const path = `xavier/${safe(input.userId, "user")}/${safe(input.taskId, "task")}.${extension}`;
  await ensureBucket();
  await upload(path, input.buffer, contentType);
  return { file_name: safe(input.fileName || input.title, "xavier-arquivo").endsWith(`.${extension}`) ? safe(input.fileName || input.title, "xavier-arquivo") : `${safe(input.fileName || input.title, "xavier-arquivo")}.${extension}`, url: await signedUrl(path), size_bytes: input.buffer.length, kind: input.kind };
}

async function createStored(input: { userId: string; taskId: string; title: string; kind: OfficeKind; requestText: string; content: string }): Promise<XavierGeneratedOfficeAttachment> {
  const prepared = officeContent(input);
  const rendered = input.kind === "document" ? renderDocx(input.title, prepared) : input.kind === "spreadsheet" ? renderXlsx(input.title, prepared) : renderSvg(input.title, prepared);
  if (rendered.length > MAX_FILE_SIZE) throw new Error("Artefato gerado excede o limite de 20 MB");
  const extension = input.kind === "document" ? "docx" : input.kind === "spreadsheet" ? "xlsx" : "svg";
  const contentType = input.kind === "document" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : input.kind === "spreadsheet" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "image/svg+xml";
  return createStoredBuffer({ userId: input.userId, taskId: input.taskId, title: input.title, kind: input.kind, buffer: rendered, contentType });
}

function officeExtension(kind: OfficeKind): string {
  return kind === "document" ? "docx" : kind === "spreadsheet" ? "xlsx" : "svg";
}

function officeMimeType(kind: OfficeKind): string {
  return kind === "document"
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : kind === "spreadsheet"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "image/svg+xml";
}

function officeFileName(title: string, kind: OfficeKind, fileName?: string): string {
  const extension = officeExtension(kind);
  const base = safe(fileName || title, "xavier-arquivo");
  return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
}

function transientOfficeArtifact(input: { title: string; kind: OfficeKind; buffer: Buffer; fileName?: string; contentType?: string }): XavierTransientOfficeArtifact {
  if (!input.buffer.length) throw new Error("O artefato gerado ficou vazio");
  if (input.buffer.length > MAX_FILE_SIZE) throw new Error("Artefato gerado excede o limite transitório de 20 MB");
  return {
    file_name: officeFileName(input.title, input.kind, input.fileName),
    bytes: input.buffer,
    mime_type: input.contentType || officeMimeType(input.kind),
    size_bytes: input.buffer.length,
    kind: input.kind,
  };
}

function officeInstruction(kind: OfficeKind): string {
  return kind === "document"
    ? "Escreva o conteúdo completo de um documento profissional em português. Use Markdown simples, com título em # e seções em ##. Não explique limitações nem use cercas de código."
    : kind === "spreadsheet"
      ? "Crie os dados de uma planilha profissional em português. Responda somente com linhas CSV usando ponto e vírgula como separador; a primeira linha deve ser o cabeçalho; não use Markdown, explicações ou cercas de código."
      : "Crie o texto de uma composição visual/infográfico em português. Responda com um título curto na primeira linha e até 10 linhas curtas de conteúdo; não use Markdown, explicações ou cercas de código.";
}

function selectGeneratedOfficeFile(files: ClaudeGeneratedFile[], kind: OfficeKind): ClaudeGeneratedFile | null {
  const extensions = kind === "document" ? [".docx", ".odt", ".rtf"] : kind === "spreadsheet" ? [".xlsx", ".xls", ".csv"] : [".svg"];
  return files.find((file) => extensions.some((extension) => file.file_name.toLowerCase().endsWith(extension))) || null;
}

export async function createXavierTransientOfficeArtifact(input: { title: string; kind: OfficeKind; requestText: string; history: ClaudeHistoryMessage[]; timeoutMs?: number }): Promise<XavierTransientOfficeArtifact> {
  const result = await generateClaudeReply({
    history: input.history,
    systemPrompt: XAVIER_CLAUDE_SYSTEM_PROMPT,
    userMessage: `${officeInstruction(input.kind)}\n\nPedido original: ${input.requestText}`,
    useWebSearch: false,
    useCodeExecution: process.env.XAVIER_CLAUDE_CODE_EXECUTION === "true",
    maxTokens: 8_000,
    timeoutMs: input.timeoutMs,
  });
  const generated = selectGeneratedOfficeFile(result.generated_files || [], input.kind);
  if (generated) return transientOfficeArtifact({ title: input.title, kind: input.kind, buffer: generated.data, fileName: generated.file_name, contentType: generated.mime_type });
  const content = officeContent({ kind: input.kind, title: input.title, requestText: input.requestText, content: appendClaudeCitations(result.reply, result.citations) });
  const rendered = input.kind === "document" ? renderDocx(input.title, content) : input.kind === "spreadsheet" ? renderXlsx(input.title, content) : renderSvg(input.title, content);
  return transientOfficeArtifact({ title: input.title, kind: input.kind, buffer: rendered });
}

export async function createXavierOfficeAttachment(input: { userId: string; taskId: string; title: string; kind: OfficeKind; requestText: string; history: ClaudeHistoryMessage[]; timeoutMs?: number }): Promise<XavierGeneratedOfficeAttachment> {
  const instruction = officeInstruction(input.kind);
  const result = await generateClaudeReply({ history: input.history, systemPrompt: XAVIER_CLAUDE_SYSTEM_PROMPT, userMessage: `${instruction}\n\nPedido original: ${input.requestText}`, useWebSearch: false, useCodeExecution: process.env.XAVIER_CLAUDE_CODE_EXECUTION === "true", maxTokens: 8_000, timeoutMs: input.timeoutMs });
  const generated = selectGeneratedOfficeFile(result.generated_files || [], input.kind);
  if (generated) {
    return createStoredBuffer({ userId: input.userId, taskId: input.taskId, title: input.title, kind: input.kind, buffer: generated.data, fileName: generated.file_name, contentType: generated.mime_type });
  }
  return createStored({ ...input, content: appendClaudeCitations(result.reply, result.citations) });
}
