import { useCallback, useEffect, useState } from "react";
import * as api from "../api/client";
import type { DocumentItem, WorkspaceSummary } from "../types";
import { DocumentsPanel } from "../components/DocumentsPanel";
import { ChatPanel } from "../components/ChatPanel";

export function Workspace() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .listWorkspaces()
      .then((ws) => {
        if (!alive) return;
        setWorkspaces(ws);
        setCurrentId((prev) => prev || ws[0]?.id || "");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const reloadDocuments = useCallback(async () => {
    if (!currentId) return;
    try {
      setDocuments(await api.listDocuments(currentId));
    } catch {
      /* ignore transient errors */
    }
  }, [currentId]);

  useEffect(() => {
    setDocuments([]);
    void reloadDocuments();
  }, [reloadDocuments]);

  // Poll while any document is still being ingested.
  const processing = documents.some((d) => d.status === "PROCESSING" || d.status === "PENDING");
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => void reloadDocuments(), 1200);
    return () => clearInterval(t);
  }, [processing, reloadDocuments]);

  async function newWorkspace() {
    const name = window.prompt("Name your new workspace")?.trim();
    if (!name) return;
    setCreating(true);
    try {
      const ws = await api.createWorkspace(name);
      setWorkspaces((prev) => [...prev, ws]);
      setCurrentId(ws.id);
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="screen-center muted">Loading workspace…</div>;

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="ws-switch">
          <label className="field-label" htmlFor="ws-select">
            Workspace
          </label>
          <div className="ws-row">
            <select
              id="ws-select"
              value={currentId}
              onChange={(e) => setCurrentId(e.target.value)}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <button className="btn ghost tiny" onClick={newWorkspace} disabled={creating}>
              + New
            </button>
          </div>
        </div>
        <DocumentsPanel workspaceId={currentId} documents={documents} onChanged={reloadDocuments} />
      </aside>

      <section className="main-pane">
        <ChatPanel workspaceId={currentId} documents={documents} />
      </section>
    </div>
  );
}
