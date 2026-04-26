import { prisma } from "@/lib/prisma";

export type AuditEvent = {
  userId?: string;
  action: string;
  resource?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

export async function auditLog(event: AuditEvent) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: event.userId,
        action: event.action,
        resource: event.resource,
        ip: event.ip,
        userAgent: event.userAgent,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write log", err);
  }
}
