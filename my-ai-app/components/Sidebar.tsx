"use client";

import Link from "next/link";
import { NyxLogo } from "./NyxLogo";

type Conversation = { id: string; title: string; updatedAt: string };

export function Sidebar(props: {
  open: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  userEmail: string;
  onSignOut: () => void;
}) {
  if (!props.open) return null;

  return (
    <aside className="glass relative flex h-full w-72 flex-col">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="accent-bg flex h-9 w-9 items-center justify-center rounded-2xl pulse-glow">
            <NyxLogo size={18} />
          </div>
          <span className="text-grad text-base font-semibold">NYXUS</span>
        </div>
        <button onClick={props.onClose} aria-label="Close sidebar" style={{ color: "var(--text-faint)" }} className="hover:opacity-80">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <button
        onClick={props.onNew}
        className="accent-bg mx-3 mb-3 flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.02]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New chat
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {props.conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs" style={{ color: "var(--text-faint)" }}>No conversations yet</p>
        ) : (
          props.conversations.map((c) => {
            const active = c.id === props.activeId;
            return (
              <div
                key={c.id}
                className={`group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm`}
                style={{
                  background: active ? "var(--glass-strong)" : "transparent",
                  color: active ? "var(--text)" : "var(--text-soft)",
                  border: active ? "1px solid var(--border-glass)" : "1px solid transparent",
                }}
                onClick={() => props.onSelect(c.id)}
              >
                <span className="truncate">{c.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onDelete(c.id);
                  }}
                  className="ml-2 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Delete conversation"
                  style={{ color: "var(--text-faint)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </nav>

      <div className="border-t px-3 py-3 text-xs" style={{ borderColor: "var(--border-soft)", color: "var(--text-muted)" }}>
        <NavLink href="/documents" icon="📄" label="Documents (RAG)" />
        <NavLink href="/security-scan" icon="🛡️" label="Code Security Scanner" />
        <NavLink href="/audit" icon="📊" label="Audit Log" />
        <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--border-soft)" }}>
          <span className="truncate" style={{ color: "var(--text-soft)" }}>{props.userEmail}</span>
          <button onClick={props.onSignOut} className="hover:underline" style={{ color: "var(--accent-strong)" }}>Sign out</button>
        </div>
      </div>
    </aside>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg px-2 py-1.5 transition-colors hover:bg-[color:var(--glass-soft)]"
      style={{ color: "var(--text-soft)" }}
    >
      <span className="mr-2">{icon}</span>{label}
    </Link>
  );
}
