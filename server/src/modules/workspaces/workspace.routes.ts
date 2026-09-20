import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireWorkspace } from "../../middleware/workspace.js";
import { validate } from "../../middleware/validate.js";
import * as workspaceController from "./workspace.controller.js";
import { createWorkspaceSchema } from "./workspace.schemas.js";
import documentsRouter from "../documents/document.routes.js";
import * as chatController from "../chat/chat.controller.js";
import { askSchema } from "../chat/chat.schemas.js";

const router = Router();

// Everything below requires a signed-in user.
router.use(authenticate);

// Workspace management.
router.get("/", workspaceController.list);
router.post("/", validate(createWorkspaceSchema), workspaceController.create);
router.get("/:workspaceId", requireWorkspace, workspaceController.detail);

// Documents (nested + workspace-scoped).
router.use("/:workspaceId/documents", requireWorkspace, documentsRouter);

// RAG chat — ask questions grounded in the workspace's documents.
router.post("/:workspaceId/ask", requireWorkspace, validate(askSchema), chatController.ask);
router.get("/:workspaceId/conversations", requireWorkspace, chatController.listConversations);
router.get(
  "/:workspaceId/conversations/:conversationId",
  requireWorkspace,
  chatController.getConversation,
);

export default router;
