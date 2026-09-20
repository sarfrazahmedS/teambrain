import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Deterministic, offline stand-in for the embedding model so the suite never
// downloads a 90MB model. The vectors are real 384-dim + normalized, so the
// pgvector search (`<=>`) — the part we actually want to exercise — runs for real.
vi.mock("../src/lib/embeddings.js", () => ({
  embed: async (text: string) => {
    const v = new Array(384).fill(0);
    for (let i = 0; i < text.length; i++) v[i % 384] += text.charCodeAt(i) / 255;
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  },
  embedBatch: async (texts: string[]) => texts.map(() => new Array(384).fill(0.05)),
  toVectorLiteral: (vec: number[]) => `[${vec.join(",")}]`,
}));

const { createApp } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");
const { resetDb } = await import("./helpers.js");

const app = createApp();
const PW = "Passw0rd1";

const register = (email: string, name = "Test User") =>
  request(app).post("/api/auth/register").send({ name, email, password: PW });
const login = (email: string) => request(app).post("/api/auth/login").send({ email, password: PW });
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as [string, string];

async function waitReady(token: string, wsId: string, docId: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await request(app).get(`/api/workspaces/${wsId}/documents/${docId}`).set(...bearer(token));
    const status = res.body.document?.status as string;
    if (status === "READY" || status === "FAILED") return status;
    await new Promise((r) => setTimeout(r, 250));
  }
  return "TIMEOUT";
}

beforeAll(async () => {
  await resetDb(prisma);
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("auth", () => {
  it("registers a new user", async () => {
    const res = await register("owner@test.dev", "Owner");
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
  });

  it("logs in with valid credentials", async () => {
    const res = await login("owner@test.dev");
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it("rejects a wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "owner@test.dev", password: "wrong123" });
    expect(res.status).toBe(401);
  });
});

describe("workspaces", () => {
  it("creates and lists a workspace", async () => {
    const token = (await login("owner@test.dev")).body.accessToken as string;
    const created = await request(app).post("/api/workspaces").set(...bearer(token)).send({ name: "Engineering" });
    expect(created.status).toBe(201);
    expect(created.body.workspace.role).toBe("OWNER");

    const listed = await request(app).get("/api/workspaces").set(...bearer(token));
    expect(listed.status).toBe(200);
    expect(listed.body.workspaces.some((w: { name: string }) => w.name === "Engineering")).toBe(true);
  });

  it("requires a token", async () => {
    const res = await request(app).get("/api/workspaces");
    expect(res.status).toBe(401);
  });
});

describe("RAG — document ingest + ask", () => {
  let token = "";
  let wsId = "";

  it("ingests an uploaded document to READY", async () => {
    token = (await login("owner@test.dev")).body.accessToken as string;
    wsId = (await request(app).post("/api/workspaces").set(...bearer(token)).send({ name: "Docs" })).body.workspace.id;

    const text =
      "ACME refund policy: customers may return any product within 30 days for a full refund. " +
      "Support is reachable at help@acme.com. The head office is in Karachi.";
    const up = await request(app)
      .post(`/api/workspaces/${wsId}/documents`)
      .set(...bearer(token))
      .send({ title: "Handbook", text });
    expect(up.status).toBe(201);

    const status = await waitReady(token, wsId, up.body.document.id);
    expect(status).toBe("READY");
  });

  it("answers a question with citations and persists the conversation", async () => {
    const res = await request(app)
      .post(`/api/workspaces/${wsId}/ask`)
      .set(...bearer(token))
      .send({ question: "What is the refund policy?" });

    expect(res.status).toBe(200);
    expect(typeof res.body.answer).toBe("string");
    expect(res.body.answer.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.citations)).toBe(true);
    expect(res.body.citations.length).toBeGreaterThan(0);
    expect(res.body.conversationId).toBeTruthy();

    const convs = await request(app).get(`/api/workspaces/${wsId}/conversations`).set(...bearer(token));
    expect(convs.body.conversations.length).toBeGreaterThanOrEqual(1);

    const detail = await request(app)
      .get(`/api/workspaces/${wsId}/conversations/${res.body.conversationId}`)
      .set(...bearer(token));
    // one USER message + one ASSISTANT message
    expect(detail.body.conversation.messages.length).toBe(2);
  });
});

describe("tenant isolation", () => {
  it("a non-member cannot read or query another workspace", async () => {
    const ownerToken = (await login("owner@test.dev")).body.accessToken as string;
    const wsId = (await request(app).post("/api/workspaces").set(...bearer(ownerToken)).send({ name: "Private" })).body
      .workspace.id;

    const outsiderToken = (await register(`outsider_${Date.now()}@test.dev`)).body.accessToken as string;

    const read = await request(app).get(`/api/workspaces/${wsId}`).set(...bearer(outsiderToken));
    expect(read.status).toBe(403);

    const ask = await request(app)
      .post(`/api/workspaces/${wsId}/ask`)
      .set(...bearer(outsiderToken))
      .send({ question: "anything?" });
    expect(ask.status).toBe(403);
  });
});
