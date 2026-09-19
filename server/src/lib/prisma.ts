import { PrismaClient } from "@prisma/client";
import { isProd } from "../env.js";

/** Single shared Prisma client. */
export const prisma = new PrismaClient({
  log: isProd ? ["error"] : ["error", "warn"],
});
