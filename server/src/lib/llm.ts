import Anthropic from "@anthropic-ai/sdk";
import { env, hasLLM } from "../env.js";

export interface RetrievedChunk {
  documentId: string;
  title: string;
  index: number;
  content: string;
}

const SYSTEM_PROMPT = `You are TeamBrain, an assistant that answers questions using ONLY the numbered context blocks from the team's own documents.
Rules:
- Ground every claim in the context. Cite sources inline with [n] matching the block numbers you used.
- If the answer is not in the context, say you couldn't find it in the team's documents — do not invent facts.
- Be clear and concise; prefer short paragraphs or bullet points.`;

function buildUserPrompt(question: string, chunks: RetrievedChunk[]): string {
  const context = chunks
    .map((c, i) => `[${i + 1}] (source: "${c.title}")\n${c.content}`)
    .join("\n\n");
  return `Context:\n${context || "(no documents matched this question)"}\n\nQuestion: ${question}`;
}

/**
 * Stream an answer as text deltas. Uses Claude when ANTHROPIC_API_KEY is set,
 * otherwise falls back to a deterministic mock so the app works with zero keys
 * (retrieval and the citations shown to the user are real either way).
 */
export async function* streamAnswer(
  question: string,
  chunks: RetrievedChunk[],
): AsyncGenerator<string> {
  if (!hasLLM) {
    yield* mockAnswer(question, chunks);
    return;
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const stream = client.messages.stream({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(question, chunks) }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

/** Offline stand-in for the LLM: summarizes the retrieved chunks with citations. */
async function* mockAnswer(question: string, chunks: RetrievedChunk[]): AsyncGenerator<string> {
  let text: string;
  if (chunks.length === 0) {
    text =
      "I couldn't find anything relevant in your team's documents for that question. Try uploading a document that covers it, then ask again.";
  } else {
    const points = chunks
      .slice(0, 3)
      .map((c, i) => `- ${c.content.replace(/\s+/g, " ").slice(0, 220).trim()}… [${i + 1}]`)
      .join("\n");
    text =
      `Based on your team's documents, here's what's relevant to “${question.trim()}”:\n\n` +
      `${points}\n\n` +
      `_Demo mode: set ANTHROPIC_API_KEY to get a full AI-written answer. The retrieval and citations above are real._`;
  }

  for (const token of text.split(/(\s+)/)) {
    yield token;
    await new Promise((resolve) => setTimeout(resolve, 8));
  }
}
