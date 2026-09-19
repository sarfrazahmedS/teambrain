import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { chunkText } from "../../lib/chunk.js";
import { embed, toVectorLiteral } from "../../lib/embeddings.js";

/** Extract plain text from a PDF buffer (imports the lib file directly — see decl). */
export async function extractPdf(buffer: Buffer): Promise<string> {
  const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
  const data = await pdfParse(buffer);
  return data.text;
}

export async function createDocument(params: {
  workspaceId: string;
  uploaderId: string;
  title: string;
  sourceType: string;
  text: string;
}) {
  const doc = await prisma.document.create({
    data: {
      workspaceId: params.workspaceId,
      uploaderId: params.uploaderId,
      title: params.title,
      sourceType: params.sourceType,
      status: "PENDING",
    },
  });

  // Fire-and-forget ingestion; progress is tracked via the document's status,
  // which the client polls. (For scale this would move to a job queue.)
  void ingest(doc.id, params.text);
  return doc;
}

async function ingest(documentId: string, text: string): Promise<void> {
  try {
    const doc = await prisma.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING", charCount: text.length },
    });

    const pieces = chunkText(text);
    for (let i = 0; i < pieces.length; i++) {
      const chunk = await prisma.chunk.create({
        data: { documentId, workspaceId: doc.workspaceId, index: i, content: pieces[i] },
      });
      const vector = await embed(pieces[i]);
      // The vector column is `Unsupported` in Prisma, so it's written via raw SQL.
      await prisma.$executeRaw`UPDATE chunks SET embedding = ${toVectorLiteral(vector)}::vector WHERE id = ${chunk.id}`;
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "READY", chunkCount: pieces.length },
    });
  } catch (err) {
    await prisma.document
      .update({
        where: { id: documentId },
        data: { status: "FAILED", error: err instanceof Error ? err.message : "Ingestion failed" },
      })
      .catch(() => {});
  }
}

export async function listDocuments(workspaceId: string) {
  return prisma.document.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      sourceType: true,
      status: true,
      error: true,
      charCount: true,
      chunkCount: true,
      createdAt: true,
    },
  });
}

export async function getDocument(workspaceId: string, documentId: string) {
  const doc = await prisma.document.findFirst({ where: { id: documentId, workspaceId } });
  if (!doc) throw new AppError(404, "Document not found");
  return doc;
}

export async function deleteDocument(workspaceId: string, documentId: string) {
  const doc = await prisma.document.findFirst({ where: { id: documentId, workspaceId } });
  if (!doc) throw new AppError(404, "Document not found");
  await prisma.document.delete({ where: { id: documentId } });
}
