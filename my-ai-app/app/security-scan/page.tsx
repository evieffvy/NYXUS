"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

type Finding = {
  id: string;
  owasp: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  line: number | null;
  snippet: string;
  explanation: string;
  fix: string;
};

type Result = { summary: string; findings: Finding[] };

const SEVERITY_TONES: Record<Finding["severity"], { bg: string; fg: string; border: string }> = {
  critical: { bg: "rgba(244,63,94,0.18)", fg: "#fb7185", border: "rgba(244,63,94,0.4)" },
  high:     { bg: "rgba(249,115,22,0.18)", fg: "#fdba74", border: "rgba(249,115,22,0.4)" },
  medium:   { bg: "rgba(251,191,36,0.18)", fg: "#fbbf24", border: "rgba(251,191,36,0.4)" },
  low:      { bg: "rgba(234,179,8,0.18)",  fg: "#facc15", border: "rgba(234,179,8,0.4)" },
  info:     { bg: "var(--accent-soft)",     fg: "var(--accent-strong)", border: "var(--border-soft)" },
};

const SAMPLE = `# Paste any code. Try this Python sample to see the scanner in action:
import sqlite3, hashlib

API_KEY = "sk_live_abc123def456ghi789jkl"

def login(username, password):
    conn = sqlite3.connect("app.db")
    q = f"SELECT * FROM users WHERE name='{username}' AND pw='{hashlib.md5(password.encode()).hexdigest()}'"
    return conn.execute(q).fetchone()
`;

export default function SecurityScanPage() {
  const [code, setCode] = useState(SAMPLE);
  const [language, setLanguage] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function scan() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/security-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "scan failed");
        return;
      }
      setResult(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-grad text-2xl font-semibold tracking-tight">Code Security Scanner</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>OWASP Top 10 analysis powered by NYX.</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/" className="text-sm font-medium hover:underline" style={{ color: "var(--accent-strong)" }}>← Back</Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass-card flex flex-col rounded-3xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="glass-input rounded-xl px-2 py-1 text-xs"
              >
                <option value="auto">Auto-detect</option>
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="go">Go</option>
                <option value="java">Java</option>
                <option value="php">PHP</option>
                <option value="ruby">Ruby</option>
                <option value="csharp">C#</option>
                <option value="rust">Rust</option>
              </select>
              <button
                onClick={scan}
                disabled={loading || !code.trim()}
                className="accent-bg rounded-xl px-4 py-1.5 text-xs font-medium text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
              >
                {loading ? "Scanning..." : "Scan code"}
              </button>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="glass-input min-h-[480px] w-full resize-none rounded-2xl p-3 font-mono text-xs"
            />
          </div>

          <div className="flex flex-col gap-3">
            {error && (
              <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "rgba(244,63,94,0.12)", color: "#fb7185", border: "1px solid rgba(244,63,94,0.3)" }}>{error}</div>
            )}
            {result && (
              <>
                <div className="glass-card rounded-3xl p-4">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Summary</h2>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{result.findings.length} finding(s)</span>
                  </div>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-soft)" }}>{result.summary}</p>
                </div>
                {result.findings.length === 0 ? (
                  <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}>
                    No vulnerabilities detected ✅
                  </div>
                ) : (
                  result.findings.map((f) => {
                    const tone = SEVERITY_TONES[f.severity];
                    return (
                      <div key={f.id} className="glass-card rounded-3xl p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: tone.bg, color: tone.fg, borderColor: tone.border }}>
                            {f.severity}
                          </span>
                          <span className="rounded-md border px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)", borderColor: "var(--border-soft)" }}>
                            {f.owasp}
                          </span>
                          {f.line && <span className="text-xs" style={{ color: "var(--text-muted)" }}>line {f.line}</span>}
                        </div>
                        <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{f.title}</h3>
                        {f.snippet && (
                          <pre className="mt-2 overflow-x-auto rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(0,0,0,0.45)", color: "#f5f3ff" }}>{f.snippet}</pre>
                        )}
                        <p className="mt-2 text-xs" style={{ color: "var(--text-soft)" }}><strong>Why:</strong> {f.explanation}</p>
                        <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}><strong>Fix:</strong> {f.fix}</p>
                      </div>
                    );
                  })
                )}
              </>
            )}
            {!result && !error && !loading && (
              <div className="glass-soft flex items-center justify-center rounded-3xl py-24 text-sm" style={{ color: "var(--text-muted)" }}>
                Click <strong className="mx-1" style={{ color: "var(--text)" }}>Scan code</strong> to analyze.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
