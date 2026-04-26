import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getClientIp } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;

  const convo = await prisma.conversation.findFirst({
    where: { id, userId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, role: true, content: true, imageData: true, createdAt: true } },
    },
  });
  if (!convo) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ conversation: convo });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.slice(0, 100).trim() : undefined;
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const updated = await prisma.conversation.updateMany({
    where: { id, userId },
    data: { title },
  });
  if (updated.count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;

  const deleted = await prisma.conversation.deleteMany({ where: { id, userId } });
  if (deleted.count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await auditLog({
    userId,
    action: "conversation.delete",
    resource: id,
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  return NextResponse.json({ ok: true });
}
