import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";
import { AppError } from "./errorHandler.js";

/**
 * Validate `{ body, query, params }` against a Zod schema. On success the
 * parsed (trimmed/coerced) body replaces `req.body`.
 */
export const validate =
  (schema: ZodTypeAny) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      throw new AppError(400, "Validation failed", result.error.flatten());
    }

    const data = result.data as { body?: unknown };
    if (data.body !== undefined) req.body = data.body;
    next();
  };
