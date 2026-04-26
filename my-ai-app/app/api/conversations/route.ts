import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getClientIp } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;

  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
    take: 100,
  });
  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim().length > 0
    ? body.title.slice(0, 100)
    : "New chat";

  const convo = await prisma.conversation.create({
    data: { userId, title },
    select: { id: true, title: true, updatedAt: true },
  });

  await auditLog({
    userId,
    action: "conversation.create",
    resource: convo.id,
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ conversation: convo });
}
