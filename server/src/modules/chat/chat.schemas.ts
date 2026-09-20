import { z } from "zod";

export const askSchema = z.object({
  body: z.object({
    question: z.string().trim().min(3, "Question is too short").max(1000),
    conversationId: z.string().cuid().optional(),
  }),
});
