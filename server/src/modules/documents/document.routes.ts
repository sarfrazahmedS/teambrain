import { Router } from "express";
import multer from "multer";
import { env } from "../../env.js";
import { requireWorkspaceRole } from "../../middleware/workspace.js";
import * as controller from "./document.controller.js";

// Files are held in memory and streamed straight into extraction/ingestion.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
});

// Mounted at /api/workspaces/:workspaceId/documents (mergeParams for :workspaceId).
const router = Router({ mergeParams: true });

router.get("/", controller.list);
router.post("/", upload.single("file"), controller.create);
router.get("/:documentId", controller.getOne);
router.delete("/:documentId", requireWorkspaceRole("OWNER", "ADMIN"), controller.remove);

export default router;
