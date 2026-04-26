"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell title="Welcome back"><div /></AuthShell>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
    } else if (res?.url) {
      window.location.href = res.url;
    }
  }

  return (
    <AuthShell title="Welcome back">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={setPassword} required autoComplete="current-password" />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="accent-bg mt-2 rounded-2xl py-3 text-sm font-medium text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <button
        onClick={() => signIn("google", { callbackUrl })}
        className="glass mt-3 w-full rounded-2xl py-3 text-sm font-medium transition-transform hover:scale-[1.02]"
        style={{ color: "var(--text)" }}
      >
        Continue with Google
      </button>
      <p className="mt-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
        No account?{" "}
        <Link href="/register" className="font-medium hover:underline" style={{ color: "var(--accent-strong)" }}>
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}

function Field(props: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium" style={{ color: "var(--text-soft)" }}>{props.label}</span>
      <input
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        required={props.required}
        autoComplete={props.autoComplete}
        className="glass-input rounded-2xl px-3 py-2.5 text-sm"
      />
    </label>
  );
}
