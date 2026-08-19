import { describe, expect, it } from "vitest";
import { extractTelegramAudioReference } from "./telegramAudio.js";

describe("Telegram audio extraction", () => {
  it("reconhece uma voice note", () => {
    expect(extractTelegramAudioReference({ voice: { file_id: "voice-1", mime_type: "audio/ogg", file_size: 1200 } })).toEqual({
      fileId: "voice-1",
      mimeType: "audio/ogg",
      fileName: "telegram-voice.ogg",
      fileSize: 1200,
    });
  });

  it("reconhece áudio enviado como arquivo", () => {
    expect(extractTelegramAudioReference({ audio: { file_id: "audio-1", file_name: "pergunta.mp3", mime_type: "audio/mpeg" } })).toEqual({
      fileId: "audio-1",
      mimeType: "audio/mpeg",
      fileName: "pergunta.mp3",
      fileSize: undefined,
    });
  });

  it("reconhece documento com MIME de áudio", () => {
    expect(extractTelegramAudioReference({ document: { file_id: "document-audio", file_name: "nota.m4a", mime_type: "audio/mp4" } })).toEqual({
      fileId: "document-audio",
      mimeType: "audio/mp4",
      fileName: "nota.m4a",
      fileSize: undefined,
    });
  });

  it("ignora documento que não é áudio", () => {
    expect(extractTelegramAudioReference({ document: { file_id: "document-text", file_name: "arquivo.txt", mime_type: "text/plain" } })).toBeNull();
  });
});
