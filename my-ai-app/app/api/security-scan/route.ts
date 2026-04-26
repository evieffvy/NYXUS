import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, getClientIp } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const schema = z.object({
  code: z.string().min(1).max(20000),
  language: z.string().max(32).optional(),
});

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const res = await fetch(`${BACKEND_URL}/security/scan-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: parsed.data.code, language: parsed.data.language ?? "auto" }),
  }).catch(() => null);

  if (!res || !res.ok) {
    return NextResponse.json(
      { error: `scanner unavailable (${res?.status ?? "no response"})` },
      { status: 502 },
    );
  }

  const data = await res.json();

  await auditLog({
    userId,
    action: "security.scan",
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
    metadata: {
      language: parsed.data.language ?? "auto",
      codeLength: parsed.data.code.length,
      findings: Array.isArray(data?.findings) ? data.findings.length : 0,
    },
  });

  return NextResponse.json(data);
}
