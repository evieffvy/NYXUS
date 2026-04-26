import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getClientIp } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import { embedTexts, topKByCosine, type ChunkLite } from "@/lib/rag";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const schema = z.object({
  conversationId: z.string().min(1),
  message: z.string().min(1).max(8000),
  useRag: z.boolean().optional(),
  image: z
    .object({
      mimeType: z.string().regex(/^image\/(png|jpeg|jpg|webp|heic|heif)$/),
      dataB64: z.string().min(1).max(10_000_000),
    })
    .optional(),
});

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const { conversationId, message, useRag = true, image } = parsed.data;

  const convo = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 40 } },
  });
  if (!convo) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const history = convo.messages.map((m) => ({ role: m.role, content: m.content }));

  let context: string | undefined;
  let ragHits = 0;
  if (useRag) {
    const ctxRes = await retrieveContext(userId, message);
    context = ctxRes.context;
    ragHits = ctxRes.hits;
  }

  await prisma.message.create({
    data: {
      conversationId,
      role: "user",
      content: message,
      imageData: image ? `data:${image.mimeType};base64,${image.dataB64}` : null,
      imageMime: image ? image.mimeType : null,
    },
  });

  await auditLog({
    userId,
    action: "chat.send",
    resource: conversationId,
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
    metadata: { length: message.length, ragHits, hasImage: !!image },
  });

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history,
        context,
        image: image ? { mime_type: image.mimeType, data_b64: image.dataB64 } : undefined,
      }),
    });
  } catch {
    return NextResponse.json({ error: "backend unreachable" }, { status: 502 });
  }
  if (!backendRes.ok || !backendRes.body) {
    const detail = await backendRes.text().catch(() => "");
    return NextResponse.json(
      { error: `backend ${backendRes.status}`, detail: detail.slice(0, 500) },
      { status: 502 },
    );
  }

  const reader = backendRes.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let assistantContent = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const event = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const line = event.trim();
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const obj = JSON.parse(data);
              if (typeof obj.token === "string") assistantContent += obj.token;
            } catch {
              // ignore non-JSON
            }
          }
          controller.enqueue(encoder.encode(decoder.decode(value)));
        }
      } catch (err) {
        const errEvent = `data: ${JSON.stringify({ error: String(err) })}\n\n`;
        controller.enqueue(encoder.encode(errEvent));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        if (assistantContent) {
          await prisma.message.create({
            data: { conversationId, role: "assistant", content: assistantContent },
          });
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function retrieveContext(userId: string, query: string): Promise<{ context?: string; hits: number }> {
  const docs = await prisma.document.findMany({ where: { userId }, select: { id: true } });
  if (docs.length === 0) return { hits: 0 };

  const chunkRows = await prisma.chunk.findMany({
    where: { documentId: { in: docs.map((d) => d.id) } },
    select: { id: true, content: true, embedding: true, documentId: true },
    take: 2000,
  });
  if (chunkRows.length === 0) return { hits: 0 };

  let queryEmbedding: number[];
  try {
    [queryEmbedding] = await embedTexts([query], "RETRIEVAL_QUERY");
  } catch {
    return { hits: 0 };
  }

  const chunks: ChunkLite[] = chunkRows.map((c) => ({
    id: c.id,
    content: c.content,
    documentId: c.documentId,
    embedding: JSON.parse(c.embedding) as number[],
  }));

  const top = topKByCosine(queryEmbedding, chunks, 5);
  if (top.length === 0) return { hits: 0 };

  const context = top.map((c, i) => `[chunk ${i + 1}]\n${c.content}`).join("\n\n");
  return { context, hits: top.length };
}
