import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import * as api from "../api/client";
import { ApiError } from "../api/client";
import type { DocumentItem, DocumentStatus } from "../types";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  PENDING: "Queued",
  PROCESSING: "Processing…",
  READY: "Ready",
  FAILED: "Failed",
};

export function DocumentsPanel({
  workspaceId,
  documents,
  onChanged,
}: {
  workspaceId: string;
  documents: DocumentItem[];
  onChanged: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addText(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.addTextDocument(workspaceId, { title: title.trim() || undefined, text });
      setTitle("");
      setText("");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add document");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await api.uploadDocument(workspaceId, file);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteDocument(workspaceId, id);
      await onChanged();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="docs">
      <h3 className="panel-title">
        Documents <span className="count">{documents.length}</span>
      </h3>

      <ul className="doc-list">
        {documents.length === 0 && (
          <li className="doc-empty muted">
            No documents yet. Add one below so TeamBrain has something to answer from.
          </li>
        )}
        {documents.map((d) => (
          <li key={d.id} className="doc-item">
            <div className="doc-main">
              <span className="doc-title" title={d.title}>
                {d.title}
              </span>
              <span className={`doc-status s-${d.status.toLowerCase()}`}>
                {d.status === "PROCESSING" && <span className="spinner" aria-hidden="true" />}
                {STATUS_LABEL[d.status]}
                {d.status === "READY" && ` · ${d.chunkCount} chunk${d.chunkCount === 1 ? "" : "s"}`}
              </span>
              {d.status === "FAILED" && d.error && <span className="doc-err">{d.error}</span>}
            </div>
            <button className="icon-btn" title="Delete document" onClick={() => remove(d.id)}>
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="add-doc">
        <div className="tabs">
          <button className={tab === "paste" ? "tab on" : "tab"} onClick={() => setTab("paste")}>
            Paste text
          </button>
          <button className={tab === "upload" ? "tab on" : "tab"} onClick={() => setTab("upload")}>
            Upload file
          </button>
        </div>

        {error && <div className="alert small">{error}</div>}

        {tab === "paste" ? (
          <form onSubmit={addText} className="paste-form">
            <input
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="Paste notes, docs, or FAQs…"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn block" disabled={busy || !text.trim()}>
              {busy ? "Adding…" : "Add document"}
            </button>
          </form>
        ) : (
          <div className="upload-form">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.markdown,text/plain"
              onChange={onFile}
              disabled={busy}
            />
            <p className="hint">.txt or .md files. (The real server also parses PDFs.)</p>
          </div>
        )}
      </div>
    </div>
  );
}
