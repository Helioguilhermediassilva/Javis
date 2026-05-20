import { useState, useEffect, useRef, useCallback } from "react";

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: { new (): ISpeechRecognition };
    webkitSpeechRecognition?: { new (): ISpeechRecognition };
  }
}

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onFinalResult?: (text: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const {
    lang = "en-US",
    continuous = true,
    interimResults = true,
    onFinalResult,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);
  const onFinalResultRef = useRef(onFinalResult);

  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  const isSupported = typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const initRecognition = useCallback((): ISpeechRecognition | null => {
    if (typeof window === "undefined") return null;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    const rec = new SR();
    rec.continuous = continuous;
    rec.interimResults = interimResults;
    rec.lang = lang;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptPart = result[0].transcript;
        if (result.isFinal) {
          finalText += transcriptPart;
        } else {
          interimText += transcriptPart;
        }
      }
      if (finalText) {
        const trimmed = finalText.trim();
        setTranscript((prev) => prev + (prev ? " " : "") + trimmed);
        setInterimTranscript("");
        onFinalResultRef.current?.(trimmed);
      } else {
        setInterimTranscript(interimText);
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        // Silent recoverable errors
        return;
      }
      setError(event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        shouldRestartRef.current = false;
        setIsListening(false);
      }
    };

    rec.onend = () => {
      if (shouldRestartRef.current) {
        try {
          rec.start();
        } catch {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    rec.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    return rec;
  }, [lang, continuous, interimResults]);

  const start = useCallback(() => {
    if (!isSupported) {
      setError("Speech recognition not supported in this browser");
      return;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch { /* ignore */ }
    }
    const rec = initRecognition();
    if (!rec) {
      setError("Failed to initialise speech recognition");
      return;
    }
    recognitionRef.current = rec;
    shouldRestartRef.current = true;
    try {
      rec.start();
    } catch (e) {
      setError(`Could not start: ${(e as Error).message}`);
    }
  }, [isSupported, initRecognition]);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch { /* ignore */ }
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch { /* ignore */ }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  };
}
