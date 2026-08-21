import { basename, extname } from "node:path";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const MAX_TELEGRAM_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_TELEGRAM_IMAGE_BYTES = 20 * 1024 * 1024;

export interface TelegramAudioReference {
  fileId: string;
  mimeType: string;
  fileName: string;
  fileSize?: number;
}

export type TelegramImageReference = TelegramAudioReference;

interface TelegramMedia {
  file_id?: string;
  file_unique_id?: string;
  file_size?: number;
  mime_type?: string;
  file_name?: string;
}

interface TelegramAudioMessage {
  voice?: TelegramMedia;
  audio?: TelegramMedia;
  document?: TelegramMedia;
}

interface TelegramImageMessage {
  photo?: TelegramMedia[];
  document?: TelegramMedia;
}

interface TelegramApiResponse<T> {
  ok?: boolean;
  result?: T;
  description?: string;
}

interface TelegramFile {
  file_path?: string;
  file_size?: number;
}

interface ElevenLabsTranscript {
  text?: string;
}

function telegramUrl(token: string, method: string): string {
  return `${TELEGRAM_API_BASE}/bot${encodeURIComponent(token)}/${method}`;
}

function mediaReference(media: TelegramMedia | undefined, defaults: { mimeType: string; fileName: string }): TelegramAudioReference | null {
  if (!media?.file_id) return null;
  return {
    fileId: media.file_id,
    mimeType: media.mime_type || defaults.mimeType,
    fileName: media.file_name || defaults.fileName,
    fileSize: media.file_size,
  };
}

/** Identifica voice notes, arquivos de áudio e documentos cujo MIME é de áudio. */
export function extractTelegramImageReference(message: TelegramImageMessage | undefined): TelegramImageReference | null {
  const photo = Array.isArray(message?.photo) ? message.photo.filter((item) => Boolean(item?.file_id)).at(-1) : undefined;
  if (photo?.file_id) {
    return mediaReference(photo, { mimeType: "image/jpeg", fileName: "telegram-photo.jpg" });
  }
  const document = message?.document;
  if (document?.file_id && (document.mime_type || "").toLowerCase().startsWith("image/")) {
    return mediaReference(document, { mimeType: document.mime_type || "image/jpeg", fileName: document.file_name || "telegram-image" });
  }
  return null;
}

export function extractTelegramAudioReference(message: TelegramAudioMessage | undefined): TelegramAudioReference | null {
  const voice = mediaReference(message?.voice, { mimeType: "audio/ogg", fileName: "telegram-voice.ogg" });
  if (voice) return voice;

  const audio = mediaReference(message?.audio, { mimeType: "audio/mpeg", fileName: "telegram-audio.mp3" });
  if (audio) return audio;

  const document = message?.document;
  if (document?.file_id && (document.mime_type || "").toLowerCase().startsWith("audio/")) {
    return mediaReference(document, { mimeType: document.mime_type || "audio/octet-stream", fileName: document.file_name || "telegram-audio" });
  }
  return null;
}

function safeFileName(filePath: string | undefined, fallback: string): string {
  const candidate = filePath ? basename(filePath).replace(/[^A-Za-z0-9._-]/g, "_") : fallback;
  return candidate || fallback;
}

function ensureExtension(fileName: string, mimeType: string): string {
  if (extname(fileName)) return fileName;
  if (mimeType === "audio/ogg") return `${fileName}.ogg`;
  if (mimeType === "audio/mpeg") return `${fileName}.mp3`;
  if (mimeType === "audio/mp4") return `${fileName}.m4a`;
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") return `${fileName}.wav`;
  if (mimeType === "image/jpeg") return `${fileName}.jpg`;
  if (mimeType === "image/png") return `${fileName}.png`;
  if (mimeType === "image/webp") return `${fileName}.webp`;
  return `${fileName}.bin`;
}

async function getTelegramFilePath(token: string, fileId: string): Promise<string> {
  const response = await fetch(telegramUrl(token, "getFile"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
    signal: AbortSignal.timeout(8_000),
  });
  const payload = (await response.json().catch(() => ({}))) as TelegramApiResponse<TelegramFile>;
  if (!response.ok || !payload.ok || !payload.result?.file_path) {
    throw new Error(`Telegram getFile falhou: ${(payload.description || `HTTP ${response.status}`).slice(0, 180)}`);
  }
  return payload.result.file_path;
}

export async function downloadTelegramImage(token: string, reference: TelegramImageReference): Promise<{ bytes: Buffer; fileName: string; mimeType: string }> {
  if (reference.fileSize && reference.fileSize > MAX_TELEGRAM_IMAGE_BYTES) {
    throw new Error("Imagem Telegram excede o limite de 20 MB");
  }
  const filePath = await getTelegramFilePath(token, reference.fileId);
  const response = await fetch(`${TELEGRAM_API_BASE}/file/bot${encodeURIComponent(token)}/${filePath}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Download da imagem Telegram falhou: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_TELEGRAM_IMAGE_BYTES) throw new Error("Imagem Telegram excede o limite de 20 MB");
  const mimeType = (reference.mimeType || response.headers.get("content-type") || "image/jpeg").split(";", 1)[0].toLowerCase();
  const fileName = ensureExtension(safeFileName(filePath, reference.fileName), mimeType);
  return { bytes, fileName, mimeType };
}

async function downloadTelegramAudio(token: string, reference: TelegramAudioReference): Promise<{ bytes: Buffer; fileName: string }> {
  if (reference.fileSize && reference.fileSize > MAX_TELEGRAM_AUDIO_BYTES) {
    throw new Error("Áudio Telegram excede o limite de 20 MB");
  }
  const filePath = await getTelegramFilePath(token, reference.fileId);
  const response = await fetch(`${TELEGRAM_API_BASE}/file/bot${encodeURIComponent(token)}/${filePath}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Download do áudio Telegram falhou: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_TELEGRAM_AUDIO_BYTES) throw new Error("Áudio Telegram excede o limite de 20 MB");
  const fileName = ensureExtension(safeFileName(filePath, reference.fileName), reference.mimeType);
  return { bytes, fileName };
}

/** Transcreve o áudio somente em memória; o arquivo bruto não é persistido. */
export async function transcribeTelegramAudio(token: string, reference: TelegramAudioReference): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY não configurada no servidor");

  const downloaded = await downloadTelegramAudio(token, reference);
  const form = new FormData();
  form.append("file", new Blob([downloaded.bytes], { type: reference.mimeType }), downloaded.fileName);
  form.append("model_id", "scribe_v2");

  const response = await fetch(ELEVENLABS_STT_URL, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
    signal: AbortSignal.timeout(25_000),
  });
  const payload = (await response.json().catch(() => ({}))) as ElevenLabsTranscript & { detail?: unknown };
  if (!response.ok) {
    const detail = typeof payload.detail === "string" ? payload.detail : `HTTP ${response.status}`;
    throw new Error(`ElevenLabs STT falhou: ${detail.slice(0, 180)}`);
  }
  const text = typeof payload.text === "string" ? payload.text.trim().slice(0, 4000) : "";
  if (!text) throw new Error("ElevenLabs STT retornou uma transcrição vazia");
  return text;
}
