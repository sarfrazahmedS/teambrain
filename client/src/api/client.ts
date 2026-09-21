import type {
  AskResponse,
  AuthResponse,
  ConversationDetail,
  ConversationSummary,
  DocumentItem,
  WorkspaceDetail,
  WorkspaceSummary,
} from "../types";
import { ApiError } from "./errors";
import * as demo from "./demo";

export { ApiError };

// Dev: "/api" is proxied to the backend by Vite. Prod: set VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL || "/api";

// Demo mode swaps the network calls for an in-memory mock backend (see demo.ts)
// so the app can be published as a static, server-less live demo. Build/run with
// VITE_DEMO=1 to enable it; it is off in every real build.
export const IS_DEMO = import.meta.env.VITE_DEMO === "1";

// The access token is kept in memory only (never in localStorage) — the
// long-lived refresh token lives in an httpOnly cookie the JS can't read.
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(res.status, (data.error as string) ?? "Request failed", data.details);
  }
  return data as T;
}

const jsonHeaders = { "Content-Type": "application/json" };

// ---------------------------------------------------------------- auth ----

export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  if (IS_DEMO) {
    const data = await demo.register(input);
    accessToken = data.accessToken;
    return data;
  }
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  const data = await parse<AuthResponse>(res);
  accessToken = data.accessToken;
  return data;
}

export async function login(input: { email: string; password: string }): Promise<AuthResponse> {
  if (IS_DEMO) {
    const data = await demo.login(input);
    accessToken = data.accessToken;
    return data;
  }
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  const data = await parse<AuthResponse>(res);
  accessToken = data.accessToken;
  return data;
}

export async function logout(): Promise<void> {
  if (IS_DEMO) {
    await demo.logout();
    accessToken = null;
    return;
  }
  await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
  accessToken = null;
}

/** Restore a session from the refresh cookie (returns null if not signed in). */
export async function refresh(): Promise<AuthResponse | null> {
  if (IS_DEMO) {
    const data = await demo.refresh();
    accessToken = data?.accessToken ?? null;
    return data;
  }
  const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
  if (!res.ok) {
    accessToken = null;
    return null;
  }
  const data = (await res.json()) as AuthResponse;
  accessToken = data.accessToken;
  return data;
}

/** Authenticated JSON request; transparently refreshes once on a 401. */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const send = () =>
    fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...jsonHeaders,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

  let res = await send();
  if (res.status === 401 && accessToken) {
    const refreshed = await refresh();
    if (refreshed) res = await send();
  }
  return parse<T>(res);
}

/** Authenticated multipart request (for file uploads — no JSON content-type). */
async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const send = () =>
    fetch(`${API_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });
  let res = await send();
  if (res.status === 401 && accessToken) {
    const refreshed = await refresh();
    if (refreshed) res = await send();
  }
  return parse<T>(res);
}

// ---------------------------------------------------------- workspaces ----

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  if (IS_DEMO) return demo.listWorkspaces();
  const { workspaces } = await apiFetch<{ workspaces: WorkspaceSummary[] }>("/workspaces");
  return workspaces;
}

export async function createWorkspace(name: string): Promise<WorkspaceSummary> {
  if (IS_DEMO) return demo.createWorkspace(name);
  const { workspace } = await apiFetch<{ workspace: WorkspaceSummary }>("/workspaces", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return workspace;
}

export async function getWorkspace(id: string): Promise<WorkspaceDetail> {
  if (IS_DEMO) return demo.getWorkspace(id);
  const { workspace } = await apiFetch<{ workspace: WorkspaceDetail }>(`/workspaces/${id}`);
  return workspace;
}

// ----------------------------------------------------------- documents ----

export async function listDocuments(workspaceId: string): Promise<DocumentItem[]> {
  if (IS_DEMO) return demo.listDocuments(workspaceId);
  const { documents } = await apiFetch<{ documents: DocumentItem[] }>(
    `/workspaces/${workspaceId}/documents`,
  );
  return documents;
}

export async function addTextDocument(
  workspaceId: string,
  input: { title?: string; text: string },
): Promise<DocumentItem> {
  if (IS_DEMO) return demo.addTextDocument(workspaceId, input);
  const { document } = await apiFetch<{ document: DocumentItem }>(
    `/workspaces/${workspaceId}/documents`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return document;
}

export async function uploadDocument(
  workspaceId: string,
  file: File,
  title?: string,
): Promise<DocumentItem> {
  if (IS_DEMO) return demo.uploadDocument(workspaceId, file, title);
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  const { document } = await apiUpload<{ document: DocumentItem }>(
    `/workspaces/${workspaceId}/documents`,
    form,
  );
  return document;
}

export async function deleteDocument(workspaceId: string, documentId: string): Promise<void> {
  if (IS_DEMO) return demo.deleteDocument(workspaceId, documentId);
  await apiFetch(`/workspaces/${workspaceId}/documents/${documentId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------- chat ----

export async function ask(
  workspaceId: string,
  input: { question: string; conversationId?: string },
): Promise<AskResponse> {
  if (IS_DEMO) return demo.ask(workspaceId, input);
  return apiFetch<AskResponse>(`/workspaces/${workspaceId}/ask`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listConversations(workspaceId: string): Promise<ConversationSummary[]> {
  if (IS_DEMO) return demo.listConversations(workspaceId);
  const { conversations } = await apiFetch<{ conversations: ConversationSummary[] }>(
    `/workspaces/${workspaceId}/conversations`,
  );
  return conversations;
}

export async function getConversation(
  workspaceId: string,
  conversationId: string,
): Promise<ConversationDetail> {
  if (IS_DEMO) return demo.getConversation(workspaceId, conversationId);
  const { conversation } = await apiFetch<{ conversation: ConversationDetail }>(
    `/workspaces/${workspaceId}/conversations/${conversationId}`,
  );
  return conversation;
}
