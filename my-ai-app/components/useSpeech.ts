"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Web Speech API types (not in default TS lib) ────────────────────────
type SRResult = { isFinal: boolean; 0: { transcript: string } };
type SREvent = { resultIndex: number; results: { [k: number]: SRResult; length: number } };
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SRCtor = new () => SR;
declare global {
  interface Window {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  }
}

export function detectLang(text: string): string {
  return /[฀-๿]/.test(text) ? "th-TH" : "en-US";
}

// ─── Speech-to-text ──────────────────────────────────────────────────────
export type StartOptions = {
  lang?: string;
  continuous?: boolean;
  /** Called when the recognition session ends, with the full final transcript. */
  onSessionEnd?: (finalText: string) => void;
};

export function useSpeechRecognition(onFinal?: (chunk: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<SR | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const onSessionEndRef = useRef<((text: string) => void) | null>(null);
  const sessionTextRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;
    setSupported(true);
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let interimText = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0].transcript;
        if (res.isFinal) finalText += t;
        else interimText += t;
      }
      setInterim(interimText);
      if (finalText) {
        sessionTextRef.current += finalText;
        onFinalRef.current?.(finalText);
      }
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      const finalText = sessionTextRef.current;
      sessionTextRef.current = "";
      const cb = onSessionEndRef.current;
      onSessionEndRef.current = null;
      if (cb) cb(finalText.trim());
    };
    r.onerror = () => {
      setListening(false);
      setInterim("");
      sessionTextRef.current = "";
      onSessionEndRef.current = null;
    };
    recRef.current = r;
    return () => {
      try { r.abort(); } catch { /* ignore */ }
    };
  }, []);

  const start = useCallback((arg?: string | StartOptions) => {
    const r = recRef.current;
    if (!r || listening) return;
    const opts: StartOptions = typeof arg === "string" ? { lang: arg } : arg ?? {};
    if (opts.lang) r.lang = opts.lang;
    r.continuous = opts.continuous ?? true;
    onSessionEndRef.current = opts.onSessionEnd ?? null;
    sessionTextRef.current = "";
    try {
      r.start();
      setListening(true);
    } catch { /* already started */ }
  }, [listening]);

  const stop = useCallback(() => {
    const r = recRef.current;
    if (!r) return;
    try { r.stop(); } catch { /* ignore */ }
  }, []);

  return { supported, listening, interim, start, stop };
}

// ─── Text-to-speech (Jarvis persona — calm UK male, slightly slower & deeper) ──
// Voice preference order. Web Speech voices vary per OS, so we cascade.
const JARVIS_NAME_PREFS = [
  "Daniel",                  // macOS UK English male — closest to Jarvis
  "Oliver", "Arthur",        // macOS UK premium
  "Google UK English Male",  // Chrome
  "Microsoft George",        // Windows UK male
  "Microsoft Mark", "Microsoft Guy", // Windows US male
  "Alex",                    // macOS US classic
  "Rishi",                   // macOS Indian English male
];

function pickJarvisVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const name of JARVIS_NAME_PREFS) {
    const hit = voices.find((v) => v.name.includes(name));
    if (hit) return hit;
  }
  // UK English fallback
  const gb = voices.find((v) => v.lang === "en-GB");
  if (gb) return gb;
  // Any English fallback
  return voices.find((v) => v.lang.startsWith("en")) ?? null;
}

function pickThaiVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return (
    voices.find((v) => v.lang === "th-TH") ??
    voices.find((v) => v.lang.startsWith("th")) ??
    null
  );
}

export function useSpeechSynthesis() {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const [voiceLabel, setVoiceLabel] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    setSupported(true);
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
      const j = pickJarvisVoice(voicesRef.current);
      setVoiceLabel(j ? j.name : "default");
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((id: string, text: string, lang?: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (!text.trim()) return;
    const finalLang = lang ?? detectLang(text);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = finalLang;

    if (finalLang.startsWith("en")) {
      const j = pickJarvisVoice(voicesRef.current);
      if (j) u.voice = j;
      u.rate = 0.95;   // slightly slower — Jarvis is deliberate
      u.pitch = 0.85;  // deeper
    } else {
      const t = pickThaiVoice(voicesRef.current);
      if (t) u.voice = t;
      u.rate = 1.0;
      u.pitch = 1.0;
    }

    u.onstart = () => setSpeakingId(id);
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(u);
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  return { supported, speakingId, speak, stop, voiceLabel };
}

// ─── Wake word ("wake up" / "wake-up" / "ตื่น") ──────────────────────────
// Uses a separate continuous SpeechRecognition that auto-restarts on `onend`,
// so the browser keeps listening even when the engine drops the session.
export function useWakeWord(
  enabled: boolean,
  onWake: () => void,
  phrases: string[] = ["nyxus", "nexus", "wakeup", "wake up", "wake-up", "hey nyxus", "hey nyx", "hey", "ตื่น"],
) {
  const [listening, setListening] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const recRef = useRef<SR | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const pausedRef = useRef(false);
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;
  const phrasesRef = useRef(phrases);
  phrasesRef.current = phrases;
  const cooldownRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      const norm = text.toLowerCase();
      const now = Date.now();
      if (now - cooldownRef.current < 2500) return;
      if (phrasesRef.current.some((p) => norm.includes(p.toLowerCase()))) {
        cooldownRef.current = now;
        onWakeRef.current();
      }
    };
    r.onend = () => {
      // Auto-restart only if enabled AND not paused (e.g. command mic is using the device)
      if (enabledRef.current && !pausedRef.current) {
        try { r.start(); } catch { /* already restarted */ }
      } else {
        setListening(false);
      }
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPermissionDenied(true);
      }
      setListening(false);
    };
    recRef.current = r;
    return () => {
      enabledRef.current = false;
      try { r.abort(); } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    const r = recRef.current;
    if (!r) return;
    if (enabled) {
      pausedRef.current = false;

      const tryStart = () => {
        try {
          r.start();
          setListening(true);
          return true;
        } catch {
          return false;
        }
      };

      // Try immediately — works if mic permission was already granted this session
      const started = tryStart();

      // Fallback: most browsers require a user gesture to start a fresh mic session
      // on a cold load. Attach a one-shot listener for ANY interaction so the wake-word
      // listener auto-activates the moment the user touches the page.
      if (!started) {
        const onGesture = () => {
          if (tryStart()) {
            window.removeEventListener("click", onGesture, true);
            window.removeEventListener("keydown", onGesture, true);
            window.removeEventListener("touchstart", onGesture, true);
            window.removeEventListener("pointerdown", onGesture, true);
          }
        };
        window.addEventListener("click", onGesture, true);
        window.addEventListener("keydown", onGesture, true);
        window.addEventListener("touchstart", onGesture, true);
        window.addEventListener("pointerdown", onGesture, true);
        return () => {
          window.removeEventListener("click", onGesture, true);
          window.removeEventListener("keydown", onGesture, true);
          window.removeEventListener("touchstart", onGesture, true);
          window.removeEventListener("pointerdown", onGesture, true);
        };
      }
    } else {
      try { r.abort(); } catch { /* ignore */ }
      setListening(false);
    }
  }, [enabled]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    const r = recRef.current;
    if (!r) return;
    try { r.abort(); } catch { /* ignore */ }
    setListening(false);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    const r = recRef.current;
    if (!r || !enabledRef.current) return;
    try {
      r.start();
      setListening(true);
    } catch { /* already running */ }
  }, []);

  return { listening, permissionDenied, pause, resume };
}
