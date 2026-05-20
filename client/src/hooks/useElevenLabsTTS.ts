import { useCallback, useEffect, useRef, useState } from "react";
import { ttsCacheKey, getCachedTtsBlob, putCachedTtsBlob, isCacheableText } from "@/lib/ttsAudioCache";

/**
 * High-quality TTS using ElevenLabs via the server-side proxy at /api/jarvis/tts.
 *
 * Streaming + caching strategy:
 *  - Frases curtas (<= CACHE_MAX_CHARS) são cacheadas em IndexedDB (Blob MP3)
 *    indexadas por SHA-256(text|voiceId). Em hits, tocamos imediatamente do
 *    cache, sem TTFB de rede.
 *  - Para frases longas (não-cacheáveis), tentamos MediaSource (lowest latency)
 *    e caímos para Blob bufferizado se não houver suporte.
 *  - Para frases curtas (cacheáveis) em cache miss, lemos o stream inteiro,
 *    persistimos no IndexedDB em background e tocamos via Blob.
 *
 * Behavior:
 *  - `speak(text)` retorna uma Promise que resolve no fim da reprodução e
 *    rejeita com Error em falhas.
 *  - `cancel()` aborta a request, para a reprodução e resolve a speak() pendente.
 */

export interface UseElevenLabsTTSReturn {
  isSpeaking: boolean;
  error: string | null;
  speak: (text: string) => Promise<void>;
  cancel: () => void;
}

const MIME_MP3 = "audio/mpeg";
// Voice ID em sincronia com server/jarvisProxy.ts (DEFAULT_VOICE_ID).
const DEFAULT_VOICE_ID = "F1W6zKJWyDQD3yKJc4A6";

function canStreamMp3(): boolean {
  try {
    return typeof window !== "undefined"
      && typeof window.MediaSource !== "undefined"
      && window.MediaSource.isTypeSupported(MIME_MP3);
  } catch {
    return false;
  }
}

export function useElevenLabsTTS(): UseElevenLabsTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const cancelResolveRef = useRef<(() => void) | null>(null);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      } catch { /* ignore */ }
      audioRef.current = null;
    }
    if (mediaSourceRef.current) {
      try {
        if (mediaSourceRef.current.readyState === "open") {
          mediaSourceRef.current.endOfStream();
        }
      } catch { /* ignore */ }
      mediaSourceRef.current = null;
    }
    if (objectUrlRef.current) {
      try { URL.revokeObjectURL(objectUrlRef.current); } catch { /* ignore */ }
      objectUrlRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { /* ignore */ }
      abortRef.current = null;
    }
    cleanupAudio();
    setIsSpeaking(false);
    if (cancelResolveRef.current) {
      const resolve = cancelResolveRef.current;
      cancelResolveRef.current = null;
      resolve();
    }
  }, [cleanupAudio]);

  const speak = useCallback((text: string): Promise<void> => {
    const trimmed = (text || "").trim();
    if (!trimmed) return Promise.resolve();
    cancel();
    setError(null);

    return new Promise<void>((resolve, reject) => {
      const controller = new AbortController();
      abortRef.current = controller;
      cancelResolveRef.current = resolve;
      setIsSpeaking(true);

      const settleOk = () => {
        cleanupAudio();
        setIsSpeaking(false);
        cancelResolveRef.current = null;
        resolve();
      };
      const settleErr = (msg: string) => {
        cleanupAudio();
        setIsSpeaking(false);
        cancelResolveRef.current = null;
        setError(msg);
        reject(new Error(msg));
      };

      const useStream = canStreamMp3();
      const cacheable = isCacheableText(trimmed);

      const playFromBlob = (blob: Blob): Promise<void> => {
        return new Promise<void>((res) => {
          if (controller.signal.aborted) { res(); return; }
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => { settleOk(); res(); };
          audio.onerror = () => { settleErr("Audio playback failed"); res(); };
          audio.play().catch((e) => {
            settleErr(`Playback blocked: ${(e as Error).message}`);
            res();
          });
        });
      };

      const fetchAndPlay = async (cacheKey: string | null) => {
        const resp = await fetch("/api/jarvis/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
          signal: controller.signal,
        });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          throw new Error(`TTS ${resp.status}: ${errText.slice(0, 200)}`);
        }
        if (!resp.body) throw new Error("Empty response body");

        if (cacheKey) {
          // Cacheable: lê todo o stream, persiste e toca como Blob.
          // ~200-400ms a mais no primeiro play, mas próximas reproduções
          // dessa frase pulam totalmente o ElevenLabs.
          const reader = resp.body.getReader();
          const chunks: Uint8Array[] = [];
          let total = 0;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value && value.length > 0) { chunks.push(value); total += value.length; }
          }
          if (controller.signal.aborted) return;
          if (total === 0) throw new Error("Empty audio stream");
          const blob = new Blob(chunks as BlobPart[], { type: MIME_MP3 });
          // Persiste em background; falhas no IndexedDB não devem afetar a fala.
          void putCachedTtsBlob(cacheKey, blob, trimmed).catch(() => undefined);
          await playFromBlob(blob);
          return;
        }

        if (useStream) {
          // Frase longa, sem cache → MediaSource (lowest latency).
          await playViaMediaSource(resp.body, controller.signal, {
            setAudio: (a) => { audioRef.current = a; },
            setMediaSource: (ms) => { mediaSourceRef.current = ms; },
            setObjectUrl: (u) => { objectUrlRef.current = u; },
            onEnded: settleOk,
            onError: settleErr,
          });
          return;
        }

        // Fallback: lê tudo e toca via Blob (sem persistir, frase é longa).
        const reader = resp.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.length > 0) { chunks.push(value); total += value.length; }
        }
        if (controller.signal.aborted) return;
        if (total === 0) throw new Error("Empty audio stream");
        const blob = new Blob(chunks as BlobPart[], { type: MIME_MP3 });
        await playFromBlob(blob);
      };

      const run = async () => {
        try {
          let cacheKey: string | null = null;
          if (cacheable) {
            cacheKey = await ttsCacheKey(trimmed, DEFAULT_VOICE_ID);
            const cached = await getCachedTtsBlob(cacheKey);
            if (cached) {
              await playFromBlob(cached);
              return;
            }
          }
          await fetchAndPlay(cacheKey);
        } catch (e: unknown) {
          if ((e as { name?: string })?.name === "AbortError") return;
          settleErr((e as Error).message || "TTS failed");
        }
      };

      void run();
    });
  }, [cancel, cleanupAudio]);

  useEffect(() => {
    return () => { cancel(); };
  }, [cancel]);

  return { isSpeaking, error, speak, cancel };
}

// ----------------------------------------------------------------------------
// MediaSource streaming helper
// ----------------------------------------------------------------------------

interface PlayViaMediaSourceHandlers {
  setAudio: (audio: HTMLAudioElement) => void;
  setMediaSource: (ms: MediaSource) => void;
  setObjectUrl: (url: string) => void;
  onEnded: () => void;
  onError: (msg: string) => void;
}

function playViaMediaSource(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  handlers: PlayViaMediaSourceHandlers,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const mediaSource = new MediaSource();
    handlers.setMediaSource(mediaSource);
    const url = URL.createObjectURL(mediaSource);
    handlers.setObjectUrl(url);

    const audio = new Audio();
    audio.src = url;
    audio.preload = "auto";
    handlers.setAudio(audio);

    let sourceBuffer: SourceBuffer | null = null;
    const queue: Uint8Array[] = [];
    let upstreamDone = false;
    let started = false;

    const pumpQueue = () => {
      if (!sourceBuffer || sourceBuffer.updating) return;
      const next = queue.shift();
      if (next) {
        try {
          sourceBuffer.appendBuffer(next as BufferSource);
        } catch (e) {
          handlers.onError(`SourceBuffer error: ${(e as Error).message}`);
        }
        return;
      }
      if (upstreamDone && mediaSource.readyState === "open") {
        try { mediaSource.endOfStream(); } catch { /* ignore */ }
      }
    };

    const tryStartPlayback = () => {
      if (started) return;
      started = true;
      audio.play().catch((e) => {
        handlers.onError(`Playback blocked: ${(e as Error).message}`);
      });
    };

    audio.addEventListener("ended", () => {
      handlers.onEnded();
      resolve();
    });
    audio.addEventListener("error", () => {
      handlers.onError("Audio element error");
      resolve();
    });

    mediaSource.addEventListener("sourceopen", async () => {
      try {
        sourceBuffer = mediaSource.addSourceBuffer(MIME_MP3);
      } catch (e) {
        handlers.onError(`addSourceBuffer failed: ${(e as Error).message}`);
        resolve();
        return;
      }
      sourceBuffer.addEventListener("updateend", () => {
        if (!started && sourceBuffer && sourceBuffer.buffered.length > 0) {
          tryStartPlayback();
        }
        pumpQueue();
      });

      const reader = body.getReader();
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (signal.aborted) return;
          if (done) {
            upstreamDone = true;
            pumpQueue();
            break;
          }
          if (value && value.length > 0) {
            queue.push(value);
            pumpQueue();
          }
        }
      } catch (e) {
        if (signal.aborted) return;
        handlers.onError(`Stream read error: ${(e as Error).message}`);
        resolve();
      }
    });
  });
}
