import { env } from "../env.js";

/**
 * Split text into overlapping chunks for embedding. Tries to end each chunk on
 * a paragraph or sentence boundary within the window so context isn't cut mid-idea.
 */
export function chunkText(
  text: string,
  size = env.CHUNK_SIZE,
  overlap = env.CHUNK_OVERLAP,
): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);

    if (end < clean.length) {
      const window = clean.slice(start, end);
      const para = window.lastIndexOf("\n\n");
      const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("\n"));
      const breakAt = para > size * 0.5 ? para : sentence > size * 0.5 ? sentence + 1 : -1;
      if (breakAt > 0) end = start + breakAt;
    }

    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
