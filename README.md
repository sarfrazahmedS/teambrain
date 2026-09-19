# TeamBrain

A **multi-tenant RAG (retrieval-augmented generation) knowledge base API**. Teams upload
their documents into isolated workspaces; TeamBrain chunks and embeds them into
**PostgreSQL + pgvector**, then answers questions with **Claude** — grounded in each team's
own documents, with citations back to the source chunks.

Built as a clean, typed **Express + Prisma** REST API with proper multi-tenancy, JWT auth,
role-based access control, request validation, rate-limiting and CI.

> **Runs free out of the box.** Embeddings are generated locally (no key, no cost). Leave
> `ANTHROPIC_API_KEY` empty to run in **demo mode** — retrieval and citations are fully real,
> and answers come from a built-in mock generator. Add a key to get full Claude-written answers.

---

## Features

- **Multi-tenant workspaces** — every document, chunk and conversation is scoped to a
  workspace; users join workspaces via memberships with per-workspace roles
  (`OWNER` / `ADMIN` / `MEMBER`).
- **Document ingestion** — upload PDFs; the service extracts text, splits it into overlapping
  chunks, embeds each chunk and stores the vectors in Postgres via **pgvector**.
- **Retrieval-augmented answers** — questions are embedded, the nearest chunks are retrieved
  by vector similarity, and Claude answers using only that retrieved context — with citations.
- **Local embeddings** — `Xenova/all-MiniLM-L6-v2` (384-dim) runs in-process, so ingestion and
  search need no external API and no cost.
- **Secure auth** — email/password with hashed credentials, short-lived JWT access tokens and
  rotating refresh tokens; login throttled by a dedicated rate-limiter.
- **Hardened API** — Helmet, CORS, per-route Zod validation, centralised error handling and
  rate-limiting.
- **CI** — GitHub Actions spins up a pgvector Postgres, runs Prisma, type-checks and builds
  the server on every push and PR.

## Tech stack

| Layer        | Tech |
|--------------|------|
| Runtime      | Node.js 20, TypeScript |
| API          | Express, Zod, Helmet, express-rate-limit |
| Data         | PostgreSQL + **pgvector**, Prisma ORM |
| Embeddings   | `@xenova/transformers` (all-MiniLM-L6-v2, 384-dim, local) |
| LLM          | Anthropic **Claude** (optional — demo mode without a key) |
| Auth         | JWT (access + rotating refresh), bcrypt |
| Ingestion    | `pdf-parse`, custom chunker |
| Dev / CI     | Docker Compose (pgvector), GitHub Actions |

## Architecture

```
Upload PDF ─▶ extract text ─▶ chunk (size 1200 / overlap 200) ─▶ embed (MiniLM, 384-d)
                                                                      │
                                                              store in pgvector
                                                                      │
Ask question ─▶ embed query ─▶ vector search (top-K) ─▶ Claude (grounded) ─▶ answer + citations
```

Data model (Prisma): `User`, `Workspace`, `Membership`, `Document`, `Chunk`,
`Conversation`, `Message`, `RefreshToken`.

## Getting started

```bash
# 1. Start a pgvector-enabled Postgres
docker compose up -d

# 2. Configure the server
cd server
cp .env.example .env          # generate JWT secrets: openssl rand -hex 32
                              # (ANTHROPIC_API_KEY optional — empty = demo mode)

# 3. Install, migrate, seed
npm install
npx prisma migrate dev
npm run db:seed

# 4. Run the API (http://localhost:4000)
npm run dev
```

## API overview

**Auth**
| Method | Route        | Description |
|--------|--------------|-------------|
| POST   | `/register`  | Create an account |
| POST   | `/login`     | Log in (rate-limited) → access + refresh tokens |
| POST   | `/refresh`   | Rotate the refresh token → new access token |
| POST   | `/logout`    | Revoke the refresh token |

**Documents** (workspace-scoped)
| Method | Route            | Description |
|--------|------------------|-------------|
| GET    | `/`              | List documents in the workspace |
| POST   | `/`              | Upload a file → ingest + embed |
| GET    | `/:documentId`   | Get one document |
| DELETE | `/:documentId`   | Delete (workspace `OWNER` / `ADMIN` only) |

Plus workspace management and a grounded chat/ask endpoint over each workspace's documents.

## Configuration

Key `.env` settings (see [`server/.env.example`](server/.env.example)):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | pgvector-enabled Postgres connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | token signing secrets |
| `ANTHROPIC_API_KEY` | optional — empty runs demo mode |
| `EMBEDDING_MODEL` / `EMBEDDING_DIM` | local embedding model (384-dim) |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` / `RETRIEVAL_K` | RAG tuning |
| `MAX_UPLOAD_MB` | upload size limit |

## Project structure

```
server/
  src/
    modules/        auth · documents · workspaces
    lib/            embeddings · chunk · llm (Claude) · jwt · prisma
    middleware/     authenticate · workspace · validate · rateLimit · errorHandler
  prisma/           schema + seed
.github/workflows/  ci.yml
docker-compose.yml  pgvector Postgres for local dev
```

## License

[MIT](LICENSE)
