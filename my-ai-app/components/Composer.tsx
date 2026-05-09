"use client";

import { useEffect, useRef, useState } from "react";
import { useSpeechRecognition } from "./useSpeech";

const MAX_BYTES = 7 * 1024 * 1024; // 7 MB
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"];

export type ComposerImage = {
  mimeType: string;
  dataB64: string;
  preview: string; // data URL
  filename: string;
};

export function Composer({
  onSend,
  disabled,
  triggerMicAt = 0,
  triggerVoiceCommandAt = 0,
}: {
  onSend: (text: string, image?: ComposerImage) => void;
  disabled: boolean;
  /** Increment to remotely start the mic in continuous mode. */
  triggerMicAt?: number;
  /** Increment to start a hands-free voice command (oneshot mic → auto-submit on silence). */
  triggerVoiceCommandAt?: number;
}) {
  const [value, setValue] = useState("");
  const [image, setImage] = useState<ComposerImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { supported: micSupported, listening, interim, start: startMic, stop: stopMic } =
    useSpeechRecognition((finalChunk) => {
      setValue((v) => (v ? `${v} ${finalChunk}` : finalChunk).trim());
    });

  // External trigger — manual mic (continuous, user clicks send)
  useEffect(() => {
    if (triggerMicAt > 0 && !listening && !disabled && micSupported) {
      startMic("en-US");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerMicAt]);

  // External trigger — voice command (oneshot, auto-submit on silence)
  useEffect(() => {
    if (triggerVoiceCommandAt > 0 && !listening && !disabled && micSupported) {
      setValue("");
      setImage((img) => img); // keep any attached image
      startMic({
        lang: "en-US",
        continuous: false,
        onSessionEnd: (finalText) => {
          const trimmed = finalText.trim();
          if (trimmed) {
            onSend(trimmed, image ?? undefined);
            setValue("");
            setImage(null);
          }
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerVoiceCommandAt]);

  function submit() {
    if (listening) stopMic();
    const text = value.trim();
    if ((!text && !image) || disabled) return;
    onSend(text || "What is in this image?", image ?? undefined);
    setValue("");
    setImage(null);
  }

  function toggleMic() {
    if (!micSupported) {
      setError("Voice input not supported in this browser");
      return;
    }
    setError(null);
    if (listening) {
      stopMic();
    } else {
      // Default to English — NYX responds in English, voice is Jarvis (en-GB),
      // and the wake-word listener is en-US. Consistent end-to-end.
      const lang = value && /[฀-๿]/.test(value) ? "th-TH" : "en-US";
      startMic({ lang, continuous: true });
    }
  }

  const displayValue = listening && interim ? `${value}${value ? " " : ""}${interim}` : value;

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setError(null);
    if (!ALLOWED.includes(file.type)) {
      setError("Use PNG, JPEG, or WebP");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image too large (max 7MB)");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const b64 = dataUrl.split(",")[1] ?? "";
    setImage({ mimeType: file.type, dataB64: b64, preview: dataUrl, filename: file.name });
  }

  return (
    <div className="px-4 pb-6 pt-3">
      <div className="mx-auto max-w-2xl">
        {image && (
          <div className="glass-card mb-2 flex items-center gap-3 rounded-2xl px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.preview} alt="preview" className="h-12 w-12 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium" style={{ color: "var(--text)" }}>{image.filename}</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{image.mimeType}</p>
            </div>
            <button
              onClick={() => setImage(null)}
              className="text-xs hover:underline"
              style={{ color: "#fb7185" }}
              aria-label="Remove image"
            >
              Remove
            </button>
          </div>
        )}
        {error && <p className="mb-2 text-xs text-rose-400">{error}</p>}

        <div className="glass-card flex items-center gap-2 rounded-3xl px-4 py-3">
          <input ref={fileRef} type="file" accept={ALLOWED.join(",")} onChange={pickImage} className="hidden" id="composer-image" />
          <label
            htmlFor="composer-image"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-105"
            style={{ background: "var(--glass-soft)", color: "var(--text-soft)", border: "1px solid var(--border-soft)" }}
            title="Attach image"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </label>

          <button
            type="button"
            onClick={toggleMic}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 ${listening ? "pulse-glow" : ""}`}
            style={{
              background: listening ? "rgba(244,63,94,0.18)" : "var(--glass-soft)",
              color: listening ? "#fb7185" : "var(--text-soft)",
              border: `1px solid ${listening ? "rgba(244,63,94,0.4)" : "var(--border-soft)"}`,
            }}
            title={listening ? "Stop listening" : "Speak (voice input)"}
            aria-label={listening ? "Stop listening" : "Voice input"}
          >
            {listening ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M19 10a7 7 0 0 1-14 0" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
            )}
          </button>

          <input
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text)" }}
            placeholder={listening ? "Listening..." : image ? "Ask about this image..." : "Ask NYX anything..."}
            value={displayValue}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={disabled}
          />
          <button
            onClick={submit}
            disabled={disabled || (!value.trim() && !image)}
            className="accent-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 disabled:opacity-40"
            aria-label="Send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
