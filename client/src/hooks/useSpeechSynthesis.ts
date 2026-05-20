import { useState, useEffect, useRef, useCallback } from "react";

interface UseSpeechSynthesisOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  preferredVoiceNames?: string[];
}

export interface UseSpeechSynthesisReturn {
  isSupported: boolean;
  isSpeaking: boolean;
  voices: SpeechSynthesisVoice[];
  speak: (text: string, onEnd?: () => void) => void;
  cancel: () => void;
}

export function useSpeechSynthesis(options: UseSpeechSynthesisOptions = {}): UseSpeechSynthesisReturn {
  const {
    lang = "en-US",
    rate = 1.0,
    pitch = 0.85,
    volume = 1.0,
    preferredVoiceNames = [
      // Vozes pt-BR (Chrome/Edge/macOS/iOS) — preferimos masculinas para combinar com a persona
      "Google português do Brasil",
      "Microsoft Daniel - Portuguese (Brazil)",
      "Microsoft Antonio - Portuguese (Brazil)",
      "Luciana",
      "Felipe",
      "Daniel",
    ],
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const onEndRef = useRef<(() => void) | null>(null);

  const isSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Load voices
  useEffect(() => {
    if (!isSupported) return;
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length > 0) setVoices(list);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [isSupported]);

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null;
    // 1) Try by exact preferred name
    for (const name of preferredVoiceNames) {
      const v = voices.find((x) => x.name === name);
      if (v) return v;
    }
    // 2) Try by partial preferred name
    for (const name of preferredVoiceNames) {
      const v = voices.find((x) => x.name.toLowerCase().includes(name.toLowerCase()));
      if (v) return v;
    }
    // 3) Match por idioma (pt-BR primeiro, depois pt-*)
    const exact = voices.filter((v) => v.lang.toLowerCase() === lang.toLowerCase());
    if (exact.length > 0) {
      const male = exact.find((v) => /daniel|antonio|felipe|male|masc/i.test(v.name));
      return male || exact[0];
    }
    const partial = voices.filter((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)));
    if (partial.length > 0) {
      const male = partial.find((v) => /daniel|antonio|felipe|male|masc/i.test(v.name));
      return male || partial[0];
    }
    return voices[0];
  }, [voices, preferredVoiceNames, lang]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!isSupported || !text.trim()) {
      onEnd?.();
      return;
    }
    // Cancel any in-progress speech
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    utter.lang = lang;
    utter.rate = rate;
    utter.pitch = pitch;
    utter.volume = volume;

    onEndRef.current = onEnd ?? null;

    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => {
      setIsSpeaking(false);
      onEndRef.current?.();
      onEndRef.current = null;
    };
    utter.onerror = () => {
      setIsSpeaking(false);
      onEndRef.current?.();
      onEndRef.current = null;
    };

    window.speechSynthesis.speak(utter);
  }, [isSupported, lang, rate, pitch, volume, pickVoice]);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    onEndRef.current = null;
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
      }
    };
  }, [isSupported]);

  return {
    isSupported,
    isSpeaking,
    voices,
    speak,
    cancel,
  };
}
