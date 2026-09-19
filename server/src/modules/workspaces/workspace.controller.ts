import type { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler.js";
import * as service from "./workspace.service.js";

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json({ workspaces: await service.listWorkspacesForUser(req.user!.id) });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const ws = await service.createWorkspace(req.user!.id, req.body.name);
  res.status(201).json({
    workspace: { id: ws.id, name: ws.name, slug: ws.slug, role: "OWNER", createdAt: ws.createdAt },
  });
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
  res.json({ workspace: await service.getWorkspaceDetail(req.workspace!.id) });
});
