"use client";

import { useEffect, useRef } from "react";
import { NyxLogo } from "./NyxLogo";

export type SecurityMeta = {
  blocked?: boolean;
  redactedTypes?: string[];
  injectionScore?: number;
  signals?: string[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  imageData?: string | null;
  security?: SecurityMeta;
};

export function MessageList({
  messages,
  loading,
  ttsSupported,
  ttsActiveId,
  onSpeak,
}: {
  messages: ChatMessage[];
  loading: boolean;
  ttsSupported: boolean;
  ttsActiveId: string | null;
  onSpeak: (id: string, text: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-4">
        {messages.length === 0 && <EmptyState />}
        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1;
          const streaming = loading && isLast && msg.role === "assistant";
          return (
            <MessageBubble
              key={msg.id}
              id={msg.id}
              role={msg.role}
              content={msg.content}
              imageData={msg.imageData}
              security={msg.security}
              streaming={streaming}
              ttsSupported={ttsSupported}
              ttsActiveId={ttsActiveId}
              onSpeak={onSpeak}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="accent-bg pulse-glow mb-5 flex h-16 w-16 items-center justify-center rounded-3xl">
        <NyxLogo size={36} />
      </div>
      <h2 className="text-grad mb-2 text-2xl font-semibold tracking-tight">NYXUS</h2>
      <p className="max-w-sm text-sm" style={{ color: "var(--text-muted)" }}>
        Hi, I&rsquo;m NYX. Ask anything — PII is redacted automatically before reaching the model.
      </p>
    </div>
  );
}

function MessageBubble({
  id,
  role,
  content,
  imageData,
  security,
  streaming = false,
  ttsSupported = false,
  ttsActiveId = null,
  onSpeak,
}: {
  id: string;
  role: ChatMessage["role"];
  content: string;
  imageData?: string | null;
  security?: SecurityMeta;
  streaming?: boolean;
  ttsSupported?: boolean;
  ttsActiveId?: string | null;
  onSpeak?: (id: string, text: string) => void;
}) {
  const isPlaying = ttsActiveId === id;
  const isUser = role === "user";
  return (
    <div className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="accent-bg mb-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
          <NyxLogo size={16} />
        </div>
      )}
      <div className="flex max-w-[78%] flex-col gap-1">
        {security && <SecurityBadges meta={security} />}
        {imageData && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageData}
            alt="attachment"
            className="max-h-64 w-auto rounded-2xl object-cover"
            style={{ border: "1px solid var(--border-glass)", boxShadow: "var(--shadow-card)" }}
          />
        )}
        {(content || !imageData) && (
          <div
            className={`whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm leading-relaxed ${
              isUser ? "rounded-br-md" : "rounded-bl-md"
            }`}
            style={{
              background: isUser ? "var(--bubble-user)" : "var(--bubble-assistant)",
              backdropFilter: "blur(20px) saturate(140%)",
              WebkitBackdropFilter: "blur(20px) saturate(140%)",
              border: "1px solid var(--border-glass)",
              boxShadow: "var(--shadow-card)",
              color: "var(--text)",
            }}
          >
            {content ? (
              <>
                {content}
                {streaming && <TypingCursor />}
              </>
            ) : (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" style={{ background: "var(--accent-strong)" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" style={{ background: "var(--accent-strong)" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" style={{ background: "var(--accent-strong)" }} />
              </span>
            )}
          </div>
        )}
        {!isUser && ttsSupported && content && !streaming && onSpeak && (
          <button
            onClick={() => onSpeak(id, content)}
            className="self-start rounded-full px-2 py-1 text-[11px] transition-opacity hover:opacity-100"
            style={{
              color: isPlaying ? "var(--accent-strong)" : "var(--text-faint)",
              opacity: isPlaying ? 1 : 0.6,
            }}
            title={isPlaying ? "Stop reading" : "Read aloud"}
            aria-label={isPlaying ? "Stop reading" : "Read aloud"}
          >
            {isPlaying ? (
              <span className="inline-flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                Stop
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
                Read
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function TypingCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-3.5 w-[2px] align-text-bottom"
      style={{ background: "var(--accent-strong)", animation: "blink 0.9s steps(2) infinite" }}
    />
  );
}

function SecurityBadges({ meta }: { meta: SecurityMeta }) {
  const badges: { label: string; tone: "danger" | "warn" | "info" }[] = [];
  if (meta.blocked) badges.push({ label: "🛡 Blocked: prompt injection", tone: "danger" });
  if (meta.redactedTypes && meta.redactedTypes.length > 0) {
    badges.push({ label: `🔒 PII redacted: ${meta.redactedTypes.join(", ")}`, tone: "warn" });
  }
  if (typeof meta.injectionScore === "number" && meta.injectionScore > 0 && !meta.blocked) {
    badges.push({ label: `⚠ Injection score: ${meta.injectionScore.toFixed(2)}`, tone: "info" });
  }
  if (badges.length === 0) return null;
  const tones: Record<string, React.CSSProperties> = {
    danger: { background: "rgba(244,63,94,0.12)", color: "#fb7185", border: "1px solid rgba(244,63,94,0.3)" },
    warn: { background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" },
    info: { background: "var(--accent-soft)", color: "var(--accent-strong)", border: "1px solid var(--border-soft)" },
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b, i) => (
        <span key={i} className="rounded-lg px-2 py-0.5 text-[10px] font-medium" style={tones[b.tone]}>
          {b.label}
        </span>
      ))}
    </div>
  );
}
