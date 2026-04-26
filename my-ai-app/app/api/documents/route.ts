import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getClientIp } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import { chunkText, embedTexts } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;

  const docs = await prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      createdAt: true,
      _count: { select: { chunks: true } },
    },
  });
  return NextResponse.json({ documents: docs });
}

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  let text = "";
  if (mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const mod = await import("pdf-parse");
    const pdfParse = (mod as unknown as { default?: (b: Buffer) => Promise<{ text: string }> }).default ?? (mod as unknown as (b: Buffer) => Promise<{ text: string }>);
    const parsed = await pdfParse(buf);
    text = parsed.text;
  } else if (mimeType.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name)) {
    text = buf.toString("utf-8");
  } else {
    return NextResponse.json({ error: "Unsupported file type. Use PDF, TXT, or MD." }, { status: 415 });
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) return NextResponse.json({ error: "Empty file" }, { status: 400 });

  let embeddings: number[][];
  try {
    embeddings = await embedTexts(chunks, "RETRIEVAL_DOCUMENT");
  } catch (e) {
    return NextResponse.json({ error: `embedding failed: ${(e as Error).message}` }, { status: 502 });
  }

  const doc = await prisma.document.create({
    data: {
      userId,
      filename: file.name,
      mimeType,
      size: file.size,
      chunks: {
        create: chunks.map((content, ordinal) => ({
          ordinal,
          content,
          embedding: JSON.stringify(embeddings[ordinal]),
        })),
      },
    },
    select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
  });

  await auditLog({
    userId,
    action: "document.upload",
    resource: doc.id,
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
    metadata: { filename: file.name, chunks: chunks.length, size: file.size },
  });

  return NextResponse.json({ document: { ...doc, chunkCount: chunks.length } });
}
