import type { SentimentLocale } from "./grokProxy.js";

const DEFAULT_VOICE_ID = "F1W6zKJWyDQD3yKJc4A6";

function voiceEnabled(): boolean {
  return (process.env.TELEGRAM_VOICE_REPLY_ENABLED || "true").toLowerCase() !== "false";
}

function languageCode(locale: SentimentLocale | undefined): string {
  if (locale === "en") return "en";
  if (locale === "es") return "es";
  return "pt";
}

function cleanVoiceText(text: string): string {
  return text.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 1_200);
}

export async function sendXavierTelegramVoiceReply(input: {
  botToken: string;
  chatId: string;
  text: string;
  locale?: SentimentLocale;
}): Promise<void> {
  if (!voiceEnabled()) return;
  const apiKey = (process.env.ELEVENLABS_API_KEY || "").trim();
  const text = cleanVoiceText(input.text);
  if (!apiKey || !text) return;
  const voiceId = (process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID).trim();
  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      language_code: languageCode(input.locale),
      voice_settings: { stability: 0.45, similarity_boost: 0.9, style: 0.15, use_speaker_boost: true },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!upstream.ok) throw new Error(`ElevenLabs TTS ${upstream.status}: ${(await upstream.text()).slice(0, 200)}`);
  const audio = Buffer.from(await upstream.arrayBuffer());
  if (!audio.length) throw new Error("ElevenLabs TTS retornou áudio vazio");
  const form = new FormData();
  form.append("chat_id", input.chatId);
  form.append("voice", new Blob([audio], { type: "audio/mpeg" }), "xavier.mp3");
  const telegram = await fetch(`https://api.telegram.org/bot${input.botToken}/sendVoice`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await telegram.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!telegram.ok || payload.ok === false) throw new Error(`Telegram sendVoice ${telegram.status}: ${(payload.description || "request failed").slice(0, 200)}`);
}
