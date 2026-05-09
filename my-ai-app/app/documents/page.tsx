"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Doc = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  _count?: { chunks: number };
  chunkCount?: number;
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Doc | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch("/api/documents");
    if (!res.ok) return;
    const { documents } = await res.json();
    setDocs(documents);
  }

  useEffect(() => {
    load();
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "upload failed");
      return;
    }
    load();
  }

  async function confirmRemove() {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    await fetch(`/api/documents/${target.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-grad text-2xl font-semibold tracking-tight">Documents</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Upload PDF or text files to chat with them via RAG.</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/" className="text-sm font-medium hover:underline" style={{ color: "var(--accent-strong)" }}>← Back</Link>
          </div>
        </div>

        <div className="glass-card mb-6 rounded-3xl p-6">
          <input ref={inputRef} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" onChange={onFile} className="hidden" id="upload" />
          <label
            htmlFor="upload"
            className="glass-soft flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-transform hover:scale-[1.01]"
            style={{ borderColor: "var(--accent-strong)" }}
          >
            {uploading ? (
              <p className="text-sm" style={{ color: "var(--text-soft)" }}>Uploading & embedding...</p>
            ) : (
              <>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3" style={{ color: "var(--accent-strong)" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Drop a PDF or click to upload</p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Max 5MB · PDF, TXT, MD</p>
              </>
            )}
          </label>
          {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
        </div>

        <div className="space-y-2">
          {docs.length === 0 ? (
            <p className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>No documents yet</p>
          ) : (
            docs.map((d) => (
              <div key={d.id} className="glass-card flex items-center justify-between rounded-2xl px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>{d.filename}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {(d.size / 1024).toFixed(1)} KB · {d._count?.chunks ?? d.chunkCount ?? 0} chunks · {new Date(d.createdAt).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => setPendingDelete(d)} className="ml-3 text-xs hover:underline" style={{ color: "#fb7185" }}>Delete</button>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this document?"
        message={pendingDelete ? `"${pendingDelete.filename}" and all its embeddings will be removed.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmRemove}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
