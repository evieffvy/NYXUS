import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getClientIp } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;

  const result = await prisma.document.deleteMany({ where: { id, userId } });
  if (result.count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await auditLog({
    userId,
    action: "document.delete",
    resource: id,
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  return NextResponse.json({ ok: true });
}
