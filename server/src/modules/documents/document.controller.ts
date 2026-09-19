import type { Request, Response } from "express";
import { asyncHandler, AppError } from "../../middleware/errorHandler.js";
import * as service from "./document.service.js";

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json({ documents: await service.listDocuments(req.workspace!.id) });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = req.workspace!.id;
  const uploaderId = req.user!.id;
  let title = (typeof req.body.title === "string" ? req.body.title : "").trim();
  let text = "";
  let sourceType = "text";

  if (req.file) {
    const name = req.file.originalname || "document";
    if (!title) title = name.replace(/\.[^.]+$/, "");
    const isPdf = req.file.mimetype === "application/pdf" || name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      sourceType = "pdf";
      text = await service.extractPdf(req.file.buffer);
    } else {
      sourceType = name.toLowerCase().endsWith(".md") ? "markdown" : "text";
      text = req.file.buffer.toString("utf-8");
    }
  } else if (typeof req.body.text === "string" && req.body.text.trim()) {
    text = req.body.text;
    sourceType = "markdown";
    if (!title) title = "Pasted note";
  } else {
    throw new AppError(400, "Provide a file or some text to add a document");
  }

  if (!text.trim()) {
    throw new AppError(400, "Couldn't extract any text from that document");
  }

  const document = await service.createDocument({ workspaceId, uploaderId, title, sourceType, text });
  res.status(201).json({ document });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json({ document: await service.getDocument(req.workspace!.id, req.params.documentId) });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteDocument(req.workspace!.id, req.params.documentId);
  res.json({ message: "Document deleted" });
});
