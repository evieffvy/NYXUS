"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Composer, ComposerImage } from "@/components/Composer";
import { MessageList, ChatMessage } from "@/components/MessageList";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useSpeechSynthesis, useWakeWord } from "@/components/useSpeech";

type Conversation = { id: string; title: string; updatedAt: string };

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);
  const lastSentRef = useRef<{ text: string; image?: ComposerImage } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Open sidebar by default on desktop only
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSidebarOpen(window.matchMedia("(min-width: 768px)").matches);
  }, []);

  // Typewriter state — drips text out smoothly so bursty backend tokens feel natural
  const targetRef = useRef("");
  const displayedRef = useRef("");
  const streamDoneRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Voice
  const tts = useSpeechSynthesis();
  // Wake word defaults ON. Persist user opt-out across reloads.
  const [wakeOn, setWakeOn] = useState(false);
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("nyxus-wake") : null;
    if (stored !== "off") setWakeOn(true);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nyxus-wake", wakeOn ? "on" : "off");
    }
  }, [wakeOn]);
  const [triggerVoiceCommandAt, setTriggerVoiceCommandAt] = useState(0);
  const autoSpeakNextRef = useRef(false);
  const lastAssistantIdRef = useRef<string | null>(null);
  const prevSpeakingIdRef = useRef<string | null>(null);

  const wake = useWakeWord(wakeOn, () => {
    autoSpeakNextRef.current = true;
    // Free the mic so the command SR can claim it (Web Speech allows only one active SR)
    wake.pause();
    if (tts.supported) tts.speak("__wake__", "Yes?");
    // Delay so the "Yes?" cue doesn't bleed into the user's command
    setTimeout(() => setTriggerVoiceCommandAt(Date.now()), 900);
  });

  // Resume wake-word listening after the assistant finishes speaking
  useEffect(() => {
    const prev = prevSpeakingIdRef.current;
    prevSpeakingIdRef.current = tts.speakingId;
    if (prev !== null && tts.speakingId === null && wakeOn && !loading) {
      // Small delay to make sure mic is fully released
      const t = setTimeout(() => wake.resume(), 400);
      return () => clearTimeout(t);
    }
  }, [tts.speakingId, wakeOn, loading, wake]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const { conversations } = await res.json();
      setConversations(conversations);
      return conversations as Conversation[];
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const { conversation } = await res.json();
    setMessages(conversation.messages);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      const list = await loadConversations();
      if (list && list.length > 0) {
        setActiveId(list[0].id);
        loadMessages(list[0].id);
      }
    })();
  }, [status, loadConversations, loadMessages]);

  async function newChat() {
    const res = await fetch("/api/conversations", { method: "POST" });
    if (!res.ok) return;
    const { conversation } = await res.json();
    setConversations((c) => [conversation, ...c]);
    setActiveId(conversation.id);
    setMessages([]);
  }

  async function selectChat(id: string) {
    setActiveId(id);
    await loadMessages(id);
    // Auto-close drawer on mobile after selection
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 768px)").matches) {
      setSidebarOpen(false);
    }
  }

  function deleteChat(id: string) {
    const target = conversations.find((c) => c.id === id);
    if (target) setPendingDelete(target);
  }

  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    await fetch(`/api/conversations/${target.id}`, { method: "DELETE" });
    setConversations((c) => c.filter((x) => x.id !== target.id));
    if (activeId === target.id) {
      setActiveId(null);
      setMessages([]);
    }
  }

  function setLastContent(text: string) {
    setMessages((m) => {
      if (m.length === 0) return m;
      const copy = [...m];
      copy[copy.length - 1] = { ...copy[copy.length - 1], content: text };
      return copy;
    });
  }

  function markLastError(text: string) {
    setMessages((m) => {
      if (m.length === 0) return m;
      const copy = [...m];
      copy[copy.length - 1] = { ...copy[copy.length - 1], content: text, errored: true };
      return copy;
    });
  }

  function retryLast() {
    const last = lastSentRef.current;
    if (!last || loading) return;
    // Remove the failed assistant message + the user message we're about to resend
    setMessages((m) => {
      if (m.length < 2) return m;
      return m.slice(0, -2);
    });
    send(last.text, last.image);
  }

  function startTyper() {
    if (rafRef.current !== null) return;
    const tick = () => {
      const target = targetRef.current;
      const cur = displayedRef.current;
      if (cur.length < target.length) {
        const gap = target.length - cur.length;
        // Adaptive: catch up faster if far behind, slow & natural when close
        const step = Math.max(1, Math.min(6, Math.ceil(gap / 40)));
        const next = target.slice(0, cur.length + step);
        displayedRef.current = next;
        setLastContent(next);
        rafRef.current = requestAnimationFrame(tick);
      } else if (!streamDoneRef.current) {
        // Caught up but stream still open — wait for more tokens
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function send(text: string, image?: ComposerImage) {
    if (loading) return;
    lastSentRef.current = { text, image };
    let convoId = activeId;
    if (!convoId) {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: text.slice(0, 60) }),
      });
      const { conversation } = await res.json();
      convoId = conversation.id;
      setConversations((c) => [conversation, ...c]);
      setActiveId(convoId);
    } else if (messages.length === 0) {
      fetch(`/api/conversations/${convoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: text.slice(0, 60) }),
      }).then(loadConversations);
    }

    const userMsg: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      imageData: image ? image.preview : null,
    };
    const assistantId = `tmp-a-${Date.now()}`;
    lastAssistantIdRef.current = assistantId;
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setLoading(true);
    tts.stop(); // cancel any ongoing speech before new turn

    // Reset typewriter
    targetRef.current = "";
    displayedRef.current = "";
    streamDoneRef.current = false;

    abortRef.current = new AbortController();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convoId,
          message: text,
          image: image ? { mimeType: image.mimeType, dataB64: image.dataB64 } : undefined,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "request failed" }));
        markLastError(`⚠️ ${data.error}`);
        return;
      }

      startTyper();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const evt = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!evt.startsWith("data: ")) continue;
          const payload = evt.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload);
            if (obj.security) {
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { ...copy[copy.length - 1], security: obj.security };
                return copy;
              });
            }
            if (typeof obj.token === "string") {
              targetRef.current += obj.token;
            } else if (obj.error) {
              targetRef.current = `⚠️ ${obj.error}`;
            }
          } catch {
            /* skip */
          }
        }
      }
      streamDoneRef.current = true;

      // Wait for typer to finish drawing the rest
      while (displayedRef.current.length < targetRef.current.length) {
        await new Promise((r) => setTimeout(r, 30));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        streamDoneRef.current = true;
        markLastError("⚠️ Connection lost");
      }
    } finally {
      setLoading(false);
      loadConversations();
      // Auto-speak final answer if a wake-word triggered this turn
      if (autoSpeakNextRef.current && targetRef.current && lastAssistantIdRef.current) {
        autoSpeakNextRef.current = false;
        tts.speak(lastAssistantIdRef.current, targetRef.current);
      }
    }
  }

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3">
          <div className="accent-bg pulse-glow flex h-12 w-12 items-center justify-center rounded-2xl">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        loading={conversationsLoading}
        conversations={conversations}
        activeId={activeId}
        onNew={newChat}
        onSelect={selectChat}
        onDelete={deleteChat}
        onClose={() => setSidebarOpen(false)}
        userEmail={session?.user?.email ?? ""}
        onSignOut={() => signOut({ callbackUrl: "/login" })}
      />

      <div className="flex flex-1 flex-col">
        <header className="glass-soft flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setSidebarOpen((s) => !s)}
            className="glass flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-105"
            aria-label="Toggle sidebar"
            style={{ color: "var(--text-soft)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="text-grad text-base font-semibold tracking-tight">NYXUS</h1>
          <div className="flex items-center gap-2">
            <WakeStatus
              wakeOn={wakeOn}
              listening={wake.listening}
              permissionDenied={wake.permissionDenied}
              voiceLabel={tts.voiceLabel}
              onToggle={() => setWakeOn((w) => !w)}
            />
            <ThemeToggle />
          </div>
        </header>

        <MessageList
          messages={messages}
          loading={loading}
          ttsSupported={tts.supported}
          ttsActiveId={tts.speakingId}
          onSpeak={(id, text) => (tts.speakingId === id ? tts.stop() : tts.speak(id, text))}
          onRetry={retryLast}
        />

        <Composer onSend={send} disabled={loading} triggerVoiceCommandAt={triggerVoiceCommandAt} />
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this conversation?"
        message={pendingDelete ? `"${pendingDelete.title}" and all its messages will be removed.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function WakeStatus({
  wakeOn,
  listening,
  permissionDenied,
  voiceLabel,
  onToggle,
}: {
  wakeOn: boolean;
  listening: boolean;
  permissionDenied: boolean;
  voiceLabel: string;
  onToggle: () => void;
}) {
  const active = wakeOn && listening;
  const denied = wakeOn && permissionDenied;

  let label = "Wake";
  let title = "Wake word disabled. Click to enable.";
  let color = "var(--text-soft)";
  let border: string | undefined;

  if (active) {
    label = "Listening";
    title = `Listening for "Nyxus" / "wakeup" / "hey" · voice: ${voiceLabel}`;
    color = "var(--accent-strong)";
    border = "1px solid var(--accent-strong)";
  } else if (denied) {
    label = "Mic blocked";
    title = "Microphone permission denied. Allow it in browser site settings, then reload.";
    color = "#fb7185";
    border = "1px solid rgba(244, 63, 94, 0.5)";
  } else if (wakeOn) {
    // Enabled, just waiting for first user interaction (browser security requires gesture)
    label = "Wake";
    title = `Wake word armed — interact with the page once to activate · voice: ${voiceLabel}`;
    color = "var(--text-muted)";
  }

  return (
    <button
      onClick={onToggle}
      className={`glass relative flex h-9 items-center gap-1.5 rounded-full px-3 transition-transform hover:scale-105 ${active ? "pulse-glow" : ""}`}
      style={{ color, border }}
      title={title}
      aria-label="Toggle wake word"
    >
      {active && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--accent-strong)", boxShadow: "0 0 8px var(--accent-strong)", animation: "blink 1.6s ease-in-out infinite" }}
        />
      )}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
      </svg>
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
