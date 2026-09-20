import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./env.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import authRouter from "./modules/auth/auth.routes.js";
import workspaceRouter from "./modules/workspaces/workspace.routes.js";

/** Build the Express app (exported so tests can drive it without a socket). */
export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.use("/api", apiLimiter);
  app.use("/api/auth", authRouter);
  app.use("/api/workspaces", workspaceRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
