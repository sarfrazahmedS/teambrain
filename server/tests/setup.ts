// Runs in each test worker BEFORE the app/prisma modules import, so the server
// connects to the TEST database. TeamBrain needs pgvector, so there is no local
// fallback — DATABASE_URL must point at a pgvector Postgres whose name contains
// "test" (a Neon branch/db locally, or the pgvector service in CI).
const url = process.env.DATABASE_URL;
if (!url || !/test/i.test(url)) {
  throw new Error(
    "Set DATABASE_URL to a pgvector Postgres whose database name contains 'test' before running the suite.",
  );
}

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret-0123456789abcdef";
process.env.NODE_ENV = "test";
