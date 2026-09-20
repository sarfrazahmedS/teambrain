import type { PrismaClient } from "@prisma/client";

/** Wipe the test database in FK-safe order. Guarded so it can never hit a real DB. */
export async function resetDb(prisma: PrismaClient): Promise<void> {
  if (!/test/i.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("Refusing to reset a non-test database");
  }
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.chunk.deleteMany();
  await prisma.document.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
}
