import { execSync } from "node:child_process";

// Push the Prisma schema (+ enable pgvector) to the TEST database once.
export default function setup(): void {
  const url = process.env.DATABASE_URL;
  if (!url || !/test/i.test(url)) {
    throw new Error("Set DATABASE_URL to a pgvector test database before running the suite.");
  }
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
