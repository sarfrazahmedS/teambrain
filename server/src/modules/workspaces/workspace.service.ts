import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { slugify } from "../../lib/slug.js";

export async function listWorkspacesForUser(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      workspace: { include: { _count: { select: { documents: true, memberships: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    role: m.role,
    documentCount: m.workspace._count.documents,
    memberCount: m.workspace._count.memberships,
    createdAt: m.workspace.createdAt,
  }));
}

export async function createWorkspace(userId: string, name: string) {
  return prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({ data: { name, slug: slugify(name) } });
    await tx.membership.create({ data: { workspaceId: ws.id, userId, role: "OWNER" } });
    return ws;
  });
}

export async function getWorkspaceDetail(workspaceId: string) {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { documents: true, conversations: true } },
    },
  });
  if (!ws) throw new AppError(404, "Workspace not found");

  return {
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    createdAt: ws.createdAt,
    documentCount: ws._count.documents,
    conversationCount: ws._count.conversations,
    members: ws.memberships.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
  };
}
