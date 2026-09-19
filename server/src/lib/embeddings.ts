import { env } from "../env.js";

// Local, free text embeddings via transformers.js (Xenova/all-MiniLM-L6-v2,
// 384-dim). The model is lazy-loaded on first use and cached in-process; it
// downloads once (~90MB) to the local cache. No API key is ever required.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loading: Promise<any> | null = null;

async function getExtractor() {
  if (extractor) return extractor;
  if (!loading) {
    loading = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      extractor = await pipeline("feature-extraction", env.EMBEDDING_MODEL);
      return extractor;
    })();
  }
  return loading;
}

/** Embed a single string into a normalized vector (length = EMBEDDING_DIM). */
export async function embed(text: string): Promise<number[]> {
  const ex = await getExtractor();
  const output = await ex(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/** Embed many strings sequentially (bounds peak memory on large documents). */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (const t of texts) vectors.push(await embed(t));
  return vectors;
}

/** Format a JS number[] as a pgvector literal, e.g. "[0.1,0.2,...]". */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
