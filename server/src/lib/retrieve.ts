import { prisma } from "./prisma.js";
import { env } from "../env.js";
import { embed, toVectorLiteral } from "./embeddings.js";
import type { RetrievedChunk } from "./llm.js";

interface Row {
  documentId: string;
  title: string;
  index: number;
  content: string;
}

/**
 * Embed the question and pull the K most similar chunks from the workspace via
 * pgvector cosine distance (`<=>`). Embeddings are normalized, so cosine is the
 * right metric. The query is scoped to `workspaceId` — never cross-tenant.
 */
export async function retrieveChunks(
  workspaceId: string,
  question: string,
  k: number = env.RETRIEVAL_K,
): Promise<RetrievedChunk[]> {
  const vector = toVectorLiteral(await embed(question));

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT c."documentId" AS "documentId", d.title AS "title", c."index" AS "index", c.content AS "content"
    FROM chunks c
    JOIN documents d ON d.id = c."documentId"
    WHERE c."workspaceId" = ${workspaceId} AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${vector}::vector
    LIMIT ${k}
  `;

  return rows.map((r) => ({
    documentId: r.documentId,
    title: r.title,
    index: r.index,
    content: r.content,
  }));
}
