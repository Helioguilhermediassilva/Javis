import { afterEach, describe, expect, it, vi } from "vitest";
import { extractTelegramAudioReference, transcribeTelegramAudio } from "./telegramAudio.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

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

  it("baixa o voice note e o envia ao STT antes do Claude", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "eleven-test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { file_path: "voice/file_1.oga" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ text: "Olá, Xavier" }), { status: 200 }));

    const text = await transcribeTelegramAudio("123:OFFICIAL_TOKEN", {
      fileId: "voice-1",
      mimeType: "audio/ogg",
      fileName: "telegram-voice.ogg",
    });

    expect(text).toBe("Olá, Xavier");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.telegram.org/bot123%3AOFFICIAL_TOKEN/getFile",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.telegram.org/file/bot123%3AOFFICIAL_TOKEN/voice/file_1.oga",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.elevenlabs.io/v1/speech-to-text",
      expect.objectContaining({
        method: "POST",
        headers: { "xi-api-key": "eleven-test-key" },
        body: expect.any(FormData),
      }),
    );
    const form = fetchMock.mock.calls[2]?.[1]?.body as FormData;
    expect(form.get("model_id")).toBe("scribe_v2");
    expect(form.get("file")).toBeInstanceOf(File);
  });
});
