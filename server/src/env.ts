import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),

  // AI answers — OPTIONAL. With no key the app uses a built-in mock generator
  // (retrieval + citations stay real), so it runs and demos with zero secrets.
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-3-5-sonnet-latest"),

  // Embeddings — free & local, run in-process via transformers.js (no API key).
  EMBEDDING_MODEL: z.string().default("Xenova/all-MiniLM-L6-v2"),
  EMBEDDING_DIM: z.coerce.number().default(384),

  // RAG tuning
  CHUNK_SIZE: z.coerce.number().default(1200), // characters per chunk
  CHUNK_OVERLAP: z.coerce.number().default(200), // characters of overlap
  RETRIEVAL_K: z.coerce.number().default(6), // chunks pulled per question
  MAX_UPLOAD_MB: z.coerce.number().default(10),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "❌ Invalid environment configuration:\n",
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
/** True when a real Claude key is configured; otherwise answers use the mock. */
export const hasLLM = Boolean(env.ANTHROPIC_API_KEY);
