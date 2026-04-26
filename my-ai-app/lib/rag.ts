const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 120;
const TOP_K = 5;

export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[\t\f\v]+/g, " ").replace(/ {2,}/g, " ").trim();
  if (clean.length <= CHUNK_SIZE) return clean ? [clean] : [];

  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + CHUNK_SIZE, clean.length);
    chunks.push(clean.slice(i, end));
    if (end >= clean.length) break;
    i = end - CHUNK_OVERLAP;
  }
  return chunks;
}

export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64);
    const res = await fetch(`${BACKEND_URL}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: batch, task_type: taskType }),
    });
    if (!res.ok) throw new Error(`embed failed: ${res.status} ${await res.text().catch(() => "")}`);
    const data = (await res.json()) as { embeddings: number[][] };
    out.push(...data.embeddings);
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

export type ChunkLite = { id: string; content: string; embedding: number[]; documentId: string };

export function topKByCosine(query: number[], chunks: ChunkLite[], k = TOP_K): ChunkLite[] {
  return chunks
    .map((c) => ({ c, score: cosine(query, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ c }) => c);
}
