import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Minimal demo seed: one user + an empty workspace to log into. Documents are
// added through the app (upload triggers embedding), so the seed stays fast.
async function main() {
  const passwordHash = await bcrypt.hash("Passw0rd!", 10);

  const user = await prisma.user.upsert({
    where: { email: "demo@teambrain.dev" },
    update: {},
    create: { email: "demo@teambrain.dev", name: "Demo User", passwordHash },
  });

  const hasWorkspace = await prisma.membership.findFirst({ where: { userId: user.id } });
  if (!hasWorkspace) {
    const ws = await prisma.workspace.create({ data: { name: "Demo Workspace", slug: "demo-workspace" } });
    await prisma.membership.create({ data: { workspaceId: ws.id, userId: user.id, role: "OWNER" } });
  }

  // eslint-disable-next-line no-console
  console.log("Seeded: demo@teambrain.dev / Passw0rd!  (+ Demo Workspace)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
