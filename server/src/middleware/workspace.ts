import type { Request, Response, NextFunction } from "express";
import type { WorkspaceRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "./errorHandler.js";

/**
 * Resolve the `:workspaceId` route param, verify the caller is a member, and
 * attach `req.workspace = { id, role }`. Enforces multi-tenant isolation:
 * every workspace-scoped route sits behind this.
 */
export function requireWorkspace(req: Request, _res: Response, next: NextFunction): void {
  (async () => {
    const workspaceId = req.params.workspaceId;
    if (!req.user) throw new AppError(401, "Not authenticated");
    if (!workspaceId) throw new AppError(400, "Missing workspace id");

    const membership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
    });
    if (!membership) throw new AppError(403, "You don't have access to this workspace");

    req.workspace = { id: workspaceId, role: membership.role };
    next();
  })().catch(next);
}

/** Require the caller to hold one of `roles` in the current workspace. */
export function requireWorkspaceRole(...roles: WorkspaceRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.workspace || !roles.includes(req.workspace.role)) {
      next(new AppError(403, "You don't have permission to do that in this workspace"));
      return;
    }
    next();
  };
}
