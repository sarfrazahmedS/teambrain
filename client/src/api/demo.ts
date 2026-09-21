import type {
  AskResponse,
  AuthResponse,
  Citation,
  ConversationDetail,
  ConversationSummary,
  DocumentItem,
  DocumentStatus,
  Message,
  User,
  WorkspaceDetail,
  WorkspaceRole,
  WorkspaceSummary,
} from "../types";
import { ApiError } from "./errors";

// An in-memory "backend" that runs entirely in the browser, enabled only when
// the app is built/run with VITE_DEMO=1 (see api/client.ts). It mirrors the real
// API shapes so the whole UI — auth, workspaces, document ingestion and RAG chat
// with citations — works as a static, server-less live demo. Retrieval and
// citations are REAL (keyword scoring over the documents' chunks); only the final
// prose is templated. The real implementation is the Express + Prisma + pgvector
// + Claude backend in server/. Nothing here is security — data lives in memory
// and resets on reload (the signed-in session persists so you stay logged in).

interface DemoUser extends User {
  password: string;
}
interface DemoChunk {
  index: number;
  content: string;
}
interface DemoDoc {
  id: string;
  workspaceId: string;
  title: string;
  sourceType: string;
  status: DocumentStatus;
  error: string | null;
  charCount: number;
  chunkCount: number;
  createdAt: string;
  chunks: DemoChunk[];
}
interface DemoWorkspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}
interface DemoMembership {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}
interface DemoConversation {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

let seq = 0;
const uid = (p = "demo") => `${p}-${(++seq).toString().padStart(4, "0")}`;
const now = () => new Date().toISOString();
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const delay = (ms = 260) => new Promise((resolve) => setTimeout(resolve, ms));
const fakeToken = () => `demo.${Math.random().toString(36).slice(2)}.${Date.now()}`;

// ---- stores -------------------------------------------------------------

const DEMO_USER_ID = "user-demo";
const DEMO_WS_ID = "ws-demo";

const users: DemoUser[] = [
  {
    id: DEMO_USER_ID,
    name: "Demo User",
    email: "demo@teambrain.dev",
    password: "Passw0rd!",
    role: "USER",
    createdAt: ago(30),
  },
];
const workspaces: DemoWorkspace[] = [
  { id: DEMO_WS_ID, name: "Acme Inc. Knowledge Base", slug: "acme-inc", createdAt: ago(30) },
];
const memberships: DemoMembership[] = [
  { workspaceId: DEMO_WS_ID, userId: DEMO_USER_ID, role: "OWNER" },
];
const documents: DemoDoc[] = [];
const conversations: DemoConversation[] = [];

// ---- seed content -------------------------------------------------------

const SEED_DOCS: Array<{ title: string; sourceType: string; body: string }> = [
  {
    title: "Engineering Onboarding Guide",
    sourceType: "markdown",
    body: `Welcome to the Acme engineering team. Your first day is about getting set up. Install Node.js 20, Docker, and the Acme CLI. Clone the monorepo and run "acme bootstrap" to install dependencies and start the local database.

We use trunk-based development. Create a short-lived feature branch off main, open a pull request early, and keep it small. Every PR needs at least one approving review and a green CI run before it can merge.

Code review focuses on correctness, readability, and tests. Reviewers should respond within one business day. Be kind and specific; suggest, don't demand. Large changes should be split into reviewable steps.

Deploys happen automatically. Merging to main triggers CI, and a successful build is promoted to staging. Production releases go out twice a day behind a feature flag, so ship dark and enable gradually.`,
  },
  {
    title: "Remote Work Policy",
    sourceType: "markdown",
    body: `Acme is remote-first. There are no fixed office hours, but teams agree on 4 hours of overlap for meetings and pairing. Core collaboration hours are 11:00–15:00 in your team's primary timezone.

Every full-time employee gets a home-office stipend of $1,000 in their first year and $400 annually after that. Use it for a desk, chair, monitor, or anything that helps you work comfortably. Keep receipts and submit them in Expensify.

Communication defaults to asynchronous. Write things down: decisions go in the docs, discussions in threads. Reserve synchronous calls for things that genuinely need them, and always post a summary afterward.

Time off is unlimited with manager approval, with a minimum of 15 days encouraged per year. Log planned leave in the HR portal at least a week ahead when you can.`,
  },
  {
    title: "Product FAQ — Acme Cloud",
    sourceType: "markdown",
    body: `Acme Cloud is billed per seat, per month. The Starter plan is $12 per user, Team is $20 per user and adds SSO and audit logs, and Enterprise is custom-priced with a dedicated success manager. Annual billing saves 20%.

Security: all data is encrypted in transit with TLS 1.3 and at rest with AES-256. We are SOC 2 Type II certified and run third-party penetration tests twice a year. Customer data is isolated per tenant.

Integrations: Acme Cloud connects to Slack, GitHub, Jira, and Google Workspace out of the box, and exposes a REST API and webhooks for anything else. API rate limits are 600 requests per minute on Team and above.

Support: Starter includes community and email support with a 48-hour response target. Team and Enterprise get priority support; Enterprise adds a 1-hour severity-1 response SLA and a private Slack channel.`,
  },
];

/** Split text into readable chunks on paragraph boundaries (~700 chars). */
function splitIntoChunks(text: string, target = 700): string[] {
  const paras = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if (buf && (buf + "\n\n" + p).length > target) {
      chunks.push(buf);
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [text.trim()].filter(Boolean);
}

// Seed the demo workspace's documents once, at module load.
for (const seed of SEED_DOCS) {
  const pieces = splitIntoChunks(seed.body);
  documents.push({
    id: uid("doc"),
    workspaceId: DEMO_WS_ID,
    title: seed.title,
    sourceType: seed.sourceType,
    status: "READY",
    error: null,
    charCount: seed.body.length,
    chunkCount: pieces.length,
    createdAt: ago(20),
    chunks: pieces.map((content, index) => ({ index, content })),
  });
}

// ---- session ------------------------------------------------------------

const SESSION_KEY = "teambrain_demo_session";

function publicUser(u: DemoUser): User {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt };
}
function saveSession(u: User) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(u));
  } catch {
    // storage blocked — session just won't survive reload
  }
}
function readSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}
function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
function requireSession(): User {
  const u = readSession();
  if (!u) throw new ApiError(401, "Not authenticated");
  return u;
}

/** Ensure a user always belongs to at least one workspace (bootstrap if none). */
function ensureWorkspace(user: User) {
  if (memberships.some((m) => m.userId === user.id)) return;
  const first = user.name.trim().split(/\s+/)[0] || user.name;
  const ws: DemoWorkspace = {
    id: uid("ws"),
    name: `${first}'s Workspace`,
    slug: `${first.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now(),
  };
  workspaces.push(ws);
  memberships.push({ workspaceId: ws.id, userId: user.id, role: "OWNER" });
}

function assertMember(workspaceId: string, userId: string): DemoMembership {
  const m = memberships.find((x) => x.workspaceId === workspaceId && x.userId === userId);
  if (!m) throw new ApiError(403, "You don't have access to this workspace");
  return m;
}

// ---- auth ---------------------------------------------------------------

function validateRegister(input: { name: string; email: string; password: string }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const { password } = input;
  if (name.length < 2) throw new ApiError(400, "Name is too short");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ApiError(400, "Please enter a valid email address");
  if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");
  if (!/[A-Za-z]/.test(password)) throw new ApiError(400, "Password must contain at least one letter");
  if (!/[0-9]/.test(password)) throw new ApiError(400, "Password must contain at least one number");
  return { name, email, password };
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  await delay();
  const { name, email, password } = validateRegister(input);
  if (users.some((u) => u.email === email))
    throw new ApiError(409, "An account with this email already exists");
  const created: DemoUser = { id: uid("user"), name, email, password, role: "USER", createdAt: now() };
  users.push(created);
  const user = publicUser(created);
  ensureWorkspace(user);
  saveSession(user);
  return { user, accessToken: fakeToken() };
}

export async function login(input: { email: string; password: string }): Promise<AuthResponse> {
  await delay();
  const email = input.email.trim().toLowerCase();
  const found = users.find((u) => u.email === email && u.password === input.password);
  if (!found) throw new ApiError(401, "Invalid email or password");
  const user = publicUser(found);
  ensureWorkspace(user);
  saveSession(user);
  return { user, accessToken: fakeToken() };
}

export async function logout(): Promise<void> {
  await delay(120);
  clearSession();
}

export async function refresh(): Promise<AuthResponse | null> {
  await delay(120);
  const user = readSession();
  if (!user) return null;
  ensureWorkspace(user);
  return { user, accessToken: fakeToken() };
}

/** `?demo_as=demo` (or any value) pre-seeds the demo session for deep links. */
export function seedSessionFromQuery() {
  try {
    if (!new URLSearchParams(window.location.search).has("demo_as")) return;
    const demo = users.find((u) => u.id === DEMO_USER_ID);
    if (demo) saveSession(publicUser(demo));
  } catch {
    // ignore
  }
}

// ---- workspaces ---------------------------------------------------------

function toSummary(ws: DemoWorkspace, role: WorkspaceRole): WorkspaceSummary {
  return {
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    role,
    documentCount: documents.filter((d) => d.workspaceId === ws.id).length,
    memberCount: memberships.filter((m) => m.workspaceId === ws.id).length,
    createdAt: ws.createdAt,
  };
}

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  await delay(160);
  const user = requireSession();
  return memberships
    .filter((m) => m.userId === user.id)
    .map((m) => {
      const ws = workspaces.find((w) => w.id === m.workspaceId)!;
      return toSummary(ws, m.role);
    });
}

export async function createWorkspace(name: string): Promise<WorkspaceSummary> {
  await delay();
  const user = requireSession();
  const ws: DemoWorkspace = {
    id: uid("ws"),
    name: name.trim(),
    slug: `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    createdAt: now(),
  };
  workspaces.push(ws);
  memberships.push({ workspaceId: ws.id, userId: user.id, role: "OWNER" });
  return toSummary(ws, "OWNER");
}

export async function getWorkspace(id: string): Promise<WorkspaceDetail> {
  await delay(160);
  const user = requireSession();
  assertMember(id, user.id);
  const ws = workspaces.find((w) => w.id === id);
  if (!ws) throw new ApiError(404, "Workspace not found");
  const members = memberships
    .filter((m) => m.workspaceId === id)
    .map((m) => {
      const u = users.find((x) => x.id === m.userId);
      return {
        id: m.userId,
        name: u?.name ?? "Member",
        email: u?.email ?? "",
        role: m.role,
      };
    });
  return {
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    createdAt: ws.createdAt,
    documentCount: documents.filter((d) => d.workspaceId === id).length,
    conversationCount: conversations.filter((c) => c.workspaceId === id).length,
    members,
  };
}

// ---- documents ----------------------------------------------------------

function toDocItem(d: DemoDoc): DocumentItem {
  return {
    id: d.id,
    title: d.title,
    sourceType: d.sourceType,
    status: d.status,
    error: d.error,
    charCount: d.charCount,
    chunkCount: d.chunkCount,
    createdAt: d.createdAt,
  };
}

export async function listDocuments(workspaceId: string): Promise<DocumentItem[]> {
  await delay(140);
  const user = requireSession();
  assertMember(workspaceId, user.id);
  return documents
    .filter((d) => d.workspaceId === workspaceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toDocItem);
}

function ingestInBackground(doc: DemoDoc, text: string) {
  // Simulate async chunk + embed with a status transition the UI can poll.
  setTimeout(() => {
    const pieces = splitIntoChunks(text);
    doc.chunks = pieces.map((content, index) => ({ index, content }));
    doc.chunkCount = pieces.length;
    doc.status = "READY";
  }, 1100);
}

function newDoc(workspaceId: string, title: string, sourceType: string, text: string): DocumentItem {
  const doc: DemoDoc = {
    id: uid("doc"),
    workspaceId,
    title: title.trim() || "Untitled",
    sourceType,
    status: "PROCESSING",
    error: null,
    charCount: text.length,
    chunkCount: 0,
    createdAt: now(),
    chunks: [],
  };
  documents.push(doc);
  ingestInBackground(doc, text);
  return toDocItem(doc);
}

export async function addTextDocument(
  workspaceId: string,
  input: { title?: string; text: string },
): Promise<DocumentItem> {
  await delay();
  const user = requireSession();
  assertMember(workspaceId, user.id);
  if (!input.text.trim()) throw new ApiError(400, "Provide some text to add a document");
  return newDoc(workspaceId, input.title || "Pasted note", "markdown", input.text);
}

export async function uploadDocument(
  workspaceId: string,
  file: File,
  title?: string,
): Promise<DocumentItem> {
  await delay();
  const user = requireSession();
  assertMember(workspaceId, user.id);
  const name = file.name || "document";
  if (name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
    throw new ApiError(
      400,
      "PDF parsing isn't available in the demo — paste text or upload a .md/.txt file. (The real server parses PDFs.)",
    );
  }
  const text = await file.text();
  if (!text.trim()) throw new ApiError(400, "Couldn't read any text from that file");
  const sourceType = name.toLowerCase().endsWith(".md") ? "markdown" : "text";
  return newDoc(workspaceId, title || name.replace(/\.[^.]+$/, ""), sourceType, text);
}

export async function deleteDocument(workspaceId: string, documentId: string): Promise<void> {
  await delay(160);
  const user = requireSession();
  assertMember(workspaceId, user.id);
  const idx = documents.findIndex((d) => d.id === documentId && d.workspaceId === workspaceId);
  if (idx === -1) throw new ApiError(404, "Document not found");
  documents.splice(idx, 1);
}

// ---- retrieval + ask ----------------------------------------------------

const STOP = new Set(
  "the a an and or of to in on for is are was were be been with that this it as at by from our your their".split(
    " ",
  ),
);
const tokenize = (s: string) =>
  (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 2 && !STOP.has(t));

interface Scored {
  documentId: string;
  title: string;
  index: number;
  content: string;
  score: number;
}

function retrieve(workspaceId: string, question: string, k = 4): Scored[] {
  const qTokens = tokenize(question);
  if (qTokens.length === 0) return [];
  const scored: Scored[] = [];
  for (const doc of documents) {
    if (doc.workspaceId !== workspaceId || doc.status !== "READY") continue;
    for (const chunk of doc.chunks) {
      const set = new Set(tokenize(chunk.content));
      let score = 0;
      for (const t of qTokens) if (set.has(t)) score += 1;
      if (score > 0) {
        scored.push({
          documentId: doc.id,
          title: doc.title,
          index: chunk.index,
          content: chunk.content,
          score,
        });
      }
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}

function composeAnswer(question: string, hits: Scored[]): string {
  if (hits.length === 0) {
    return "I couldn't find anything relevant in your team's documents for that question. Try uploading a document that covers it, or rephrase the question.";
  }
  const points = hits
    .slice(0, 3)
    .map((h, i) => `- ${h.content.replace(/\s+/g, " ").slice(0, 200).trim()}… [${i + 1}]`)
    .join("\n");
  return (
    `Based on your team's documents, here's what's relevant to “${question.trim()}”:\n\n${points}\n\n` +
    `_Demo mode: this heuristic answer runs over real retrieval + citations. With an \`ANTHROPIC_API_KEY\`, the server returns a full Claude-written answer._`
  );
}

export async function ask(
  workspaceId: string,
  input: { question: string; conversationId?: string },
): Promise<AskResponse> {
  const user = requireSession();
  assertMember(workspaceId, user.id);
  const question = input.question.trim();

  let conv = input.conversationId
    ? conversations.find(
        (c) => c.id === input.conversationId && c.workspaceId === workspaceId && c.userId === user.id,
      )
    : undefined;
  if (input.conversationId && !conv) throw new ApiError(404, "Conversation not found");
  if (!conv) {
    conv = {
      id: uid("conv"),
      workspaceId,
      userId: user.id,
      title: question.slice(0, 60),
      createdAt: now(),
      updatedAt: now(),
      messages: [],
    };
    conversations.push(conv);
  }

  await delay(340);
  const hits = retrieve(workspaceId, question);
  const citations: Citation[] = hits.map((h, i) => ({
    n: i + 1,
    documentId: h.documentId,
    title: h.title,
    index: h.index,
  }));
  const answer = composeAnswer(question, hits);

  conv.messages.push({
    id: uid("msg"),
    role: "USER",
    content: question,
    citations: null,
    createdAt: now(),
  });
  conv.messages.push({
    id: uid("msg"),
    role: "ASSISTANT",
    content: answer,
    citations,
    createdAt: now(),
  });
  conv.updatedAt = now();

  return { conversationId: conv.id, answer, citations };
}

export async function listConversations(workspaceId: string): Promise<ConversationSummary[]> {
  await delay(140);
  const user = requireSession();
  assertMember(workspaceId, user.id);
  return conversations
    .filter((c) => c.workspaceId === workspaceId && c.userId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((c) => ({ id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt }));
}

export async function getConversation(
  workspaceId: string,
  conversationId: string,
): Promise<ConversationDetail> {
  await delay(160);
  const user = requireSession();
  assertMember(workspaceId, user.id);
  const conv = conversations.find(
    (c) => c.id === conversationId && c.workspaceId === workspaceId && c.userId === user.id,
  );
  if (!conv) throw new ApiError(404, "Conversation not found");
  return {
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messages: conv.messages,
  };
}
