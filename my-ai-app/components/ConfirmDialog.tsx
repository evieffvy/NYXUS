"use client";

import { useEffect, useRef } from "react";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onCancel}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div className="glass-card relative w-full max-w-sm rounded-3xl p-6">
        <h2 id="confirm-title" className="text-base font-semibold" style={{ color: "var(--text)" }}>
          {title}
        </h2>
        {message && (
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            {message}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="glass rounded-2xl px-4 py-2 text-sm font-medium transition-transform hover:scale-[1.02]"
            style={{ color: "var(--text-soft)" }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="rounded-2xl px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-[1.02]"
            style={
              destructive
                ? { background: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)" }
                : { background: "var(--accent)" }
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
