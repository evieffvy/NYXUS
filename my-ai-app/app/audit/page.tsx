"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

type Log = {
  id: string;
  action: string;
  resource: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

const ACTION_TONES: Record<string, { bg: string; fg: string }> = {
  "auth.register": { bg: "rgba(16,185,129,0.15)", fg: "#34d399" },
  "auth.login": { bg: "rgba(16,185,129,0.15)", fg: "#34d399" },
  "chat.send": { bg: "var(--accent-soft)", fg: "var(--accent-strong)" },
  "conversation.create": { bg: "rgba(59,130,246,0.15)", fg: "#60a5fa" },
  "conversation.delete": { bg: "rgba(244,63,94,0.15)", fg: "#fb7185" },
  "document.upload": { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24" },
  "document.delete": { bg: "rgba(244,63,94,0.15)", fg: "#fb7185" },
  "security.scan": { bg: "rgba(139,92,246,0.15)", fg: "#a78bfa" },
};

const FALLBACK = { bg: "var(--glass-soft)", fg: "var(--text-soft)" };

export default function AuditPage() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    fetch("/api/audit").then((r) => r.json()).then((d) => setLogs(d.logs ?? []));
  }, []);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-grad text-2xl font-semibold tracking-tight">Audit Log</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Last 100 actions on your account.</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/" className="text-sm font-medium hover:underline" style={{ color: "var(--accent-strong)" }}>← Back</Link>
          </div>
        </div>

        <div className="glass-card overflow-hidden rounded-3xl">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide" style={{ borderBottom: "1px solid var(--border-soft)", color: "var(--text-muted)" }}>
              <tr>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center" style={{ color: "var(--text-faint)" }}>No audit entries</td>
                </tr>
              ) : (
                logs.map((l) => {
                  const tone = ACTION_TONES[l.action] ?? FALLBACK;
                  return (
                    <tr key={l.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                      <td className="px-4 py-3">
                        <span className="rounded-md px-2 py-0.5 text-xs font-medium" style={{ background: tone.bg, color: tone.fg }}>
                          {l.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{l.resource ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{l.ip ?? "—"}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{new Date(l.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
