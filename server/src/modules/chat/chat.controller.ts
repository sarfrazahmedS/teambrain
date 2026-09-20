import type { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler.js";
import * as service from "./chat.service.js";

export const ask = asyncHandler(async (req: Request, res: Response) => {
  const { question, conversationId } = req.body as { question: string; conversationId?: string };
  const result = await service.answerQuestion({
    workspaceId: req.workspace!.id,
    userId: req.user!.id,
    question,
    conversationId,
  });
  res.json(result);
});

export const listConversations = asyncHandler(async (req: Request, res: Response) => {
  const conversations = await service.listConversations(req.workspace!.id, req.user!.id);
  res.json({ conversations });
});

export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const conversation = await service.getConversation(
    req.workspace!.id,
    req.user!.id,
    req.params.conversationId!,
  );
  res.json({ conversation });
});
