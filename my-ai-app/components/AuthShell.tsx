"use client";

import { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { NyxLogo } from "./NyxLogo";

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="glass-card relative w-full max-w-sm rounded-3xl p-8 glow">
        <div className="mb-6 flex items-center gap-3">
          <div className="accent-bg flex h-11 w-11 items-center justify-center rounded-2xl pulse-glow">
            <NyxLogo size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-grad">NYXUS</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{title}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
