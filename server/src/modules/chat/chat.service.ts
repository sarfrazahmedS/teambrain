import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { retrieveChunks } from "../../lib/retrieve.js";
import { streamAnswer, type RetrievedChunk } from "../../lib/llm.js";

export interface Citation {
  n: number;
  documentId: string;
  title: string;
  index: number;
}

function toCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((c, i) => ({ n: i + 1, documentId: c.documentId, title: c.title, index: c.index }));
}

/**
 * The RAG core: retrieve the most relevant chunks for the question, generate a
 * grounded answer (Claude, or the offline mock), and persist the exchange to a
 * conversation. Everything is scoped to the caller's workspace.
 */
export async function answerQuestion(params: {
  workspaceId: string;
  userId: string;
  question: string;
  conversationId?: string;
}): Promise<{ conversationId: string; answer: string; citations: Citation[] }> {
  const { workspaceId, userId, question } = params;

  // Resolve (or start) the conversation — scoped to this workspace + user.
  let conversationId = params.conversationId;
  if (conversationId) {
    const existing = await prisma.conversation.findFirst({
      where: { id: conversationId, workspaceId, userId },
      select: { id: true },
    });
    if (!existing) throw new AppError(404, "Conversation not found");
  } else {
    const created = await prisma.conversation.create({
      data: { workspaceId, userId, title: question.slice(0, 60) },
      select: { id: true },
    });
    conversationId = created.id;
  }

  const chunks = await retrieveChunks(workspaceId, question);
  const citations = toCitations(chunks);

  let answer = "";
  for await (const delta of streamAnswer(question, chunks)) answer += delta;

  await prisma.message.create({
    data: { conversationId, userId, role: "USER", content: question },
  });
  await prisma.message.create({
    data: {
      conversationId,
      role: "ASSISTANT",
      content: answer,
      citations: citations as unknown as Prisma.InputJsonValue,
    },
  });
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

  return { conversationId, answer, citations };
}

export async function listConversations(workspaceId: string, userId: string) {
  return prisma.conversation.findMany({
    where: { workspaceId, userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
}

export async function getConversation(workspaceId: string, userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, workspaceId, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) throw new AppError(404, "Conversation not found");
  return conversation;
}
