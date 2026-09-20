import { createApp } from "./app.js";
import { env } from "./env.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`TeamBrain API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received — shutting down.`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
