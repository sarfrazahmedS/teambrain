import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Markdown from "react-markdown";
import * as api from "../api/client";
import { ApiError, IS_DEMO } from "../api/client";
import type { Citation, DocumentItem, Message } from "../types";

const SAMPLES = [
  "What's the remote work stipend?",
  "How do deploys work?",
  "What does the Team plan include?",
];

export function ChatPanel({
  workspaceId,
  documents,
}: {
  workspaceId: string;
  documents: DocumentItem[];
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Reset the thread when the workspace changes.
  useEffect(() => {
    setMessages([]);
    setConversationId(undefined);
  }, [workspaceId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // Demo-only: a `?ask=…` deep link auto-asks once (nice for sharing + screenshots).
  const autoAsked = useRef(false);
  useEffect(() => {
    if (autoAsked.current || !workspaceId) return;
    const q = new URLSearchParams(window.location.search).get("ask");
    if (IS_DEMO && q) {
      autoAsked.current = true;
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const readyCount = documents.filter((d) => d.status === "READY").length;

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setError(null);
    setBusy(true);
    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, role: "USER", content: question, createdAt: new Date().toISOString() },
    ]);
    setQuestion("");
    try {
      const res = await api.ask(workspaceId, { question, conversationId });
      setConversationId(res.conversationId);
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "ASSISTANT",
          content: res.answer,
          citations: res.citations,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(question);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(question);
    }
  }

  return (
    <div className="chat">
      <div className="chat-scroll">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-badge">🧠</div>
            <h2>Ask your team&apos;s documents</h2>
            <p className="muted">
              TeamBrain retrieves the most relevant passages from your {readyCount} ready document
              {readyCount === 1 ? "" : "s"} and answers with citations.
            </p>
            <div className="samples">
              {SAMPLES.map((s) => (
                <button key={s} className="sample" onClick={() => void send(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        {busy && (
          <div className="msg assistant">
            <div className="bubble">
              <span className="typing" aria-label="Thinking">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <div className="alert">{error}</div>}

      <form className="ask-form" onSubmit={onSubmit}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={readyCount ? "Ask a question about your documents…" : "Add a document first, then ask…"}
          rows={1}
        />
        <button className="btn" disabled={busy || !question.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "USER";
  return (
    <div className={`msg ${isUser ? "user" : "assistant"}`}>
      <div className="bubble">
        {isUser ? (
          <p className="user-text">{message.content}</p>
        ) : (
          <div className="md">
            <Markdown>{message.content}</Markdown>
          </div>
        )}
        {!isUser && message.citations && message.citations.length > 0 && (
          <Citations items={message.citations} />
        )}
      </div>
    </div>
  );
}

function Citations({ items }: { items: Citation[] }) {
  return (
    <div className="citations">
      <span className="cite-label">Sources</span>
      {items.map((c) => (
        <span key={c.n} className="cite" title={`From “${c.title}”, chunk ${c.index + 1}`}>
          <b>{c.n}</b> {c.title}
        </span>
      ))}
    </div>
  );
}
