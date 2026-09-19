import "express";
import type { Role, WorkspaceRole } from "@prisma/client";

// Make the authenticated user (and the resolved workspace context) available
// and typed on every Express request.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
      workspace?: { id: string; role: WorkspaceRole };
    }
  }
}

export {};
