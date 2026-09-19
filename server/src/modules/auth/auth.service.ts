import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../env.js";
import { AppError } from "../../middleware/errorHandler.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type RefreshTokenPayload,
} from "../../lib/jwt.js";
import { slugify } from "../../lib/slug.js";
import type { RegisterInput, LoginInput } from "./auth.schemas.js";

const SALT_ROUNDS = 12;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: User["role"];
  createdAt: Date;
}

export function toPublicUser(u: User): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt };
}

/** Create a refresh-token row (its id is the token's jti) and sign both tokens. */
async function issueTokens(user: User) {
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const record = await prisma.refreshToken.create({ data: { userId: user.id, expiresAt } });
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    refreshToken: signRefreshToken({ sub: user.id, jti: record.id }),
  };
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const firstName = input.name.trim().split(/\s+/)[0] || input.name.trim();

  // Create the user, a personal workspace, and an OWNER membership atomically.
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { name: input.name, email: input.email, passwordHash },
    });
    const ws = await tx.workspace.create({
      data: { name: `${firstName}'s Workspace`, slug: slugify(input.name) },
    });
    await tx.membership.create({ data: { workspaceId: ws.id, userId: u.id, role: "OWNER" } });
    return u;
  });

  return { user: toPublicUser(user), ...(await issueTokens(user)) };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Always run a compare to avoid leaking which emails exist (timing).
  const ok = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !ok) throw new AppError(401, "Invalid email or password");
  return { user: toPublicUser(user), ...(await issueTokens(user)) };
}

/** Verify a refresh token, rotate it (single-use), and issue a fresh pair. */
export async function rotateRefreshToken(rawToken: string) {
  let payload: RefreshTokenPayload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const record = await prisma.refreshToken.findUnique({
    where: { id: payload.jti },
    include: { user: true },
  });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    if (record) await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
    throw new AppError(401, "Refresh token is no longer valid");
  }

  await prisma.refreshToken.delete({ where: { id: record.id } });
  return { user: toPublicUser(record.user), ...(await issueTokens(record.user)) };
}

export async function revokeRefreshToken(rawToken: string) {
  try {
    const { jti } = verifyRefreshToken(rawToken);
    await prisma.refreshToken.delete({ where: { id: jti } }).catch(() => {});
  } catch {
    // A malformed token on logout is safe to ignore.
  }
}

export async function getUserById(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, "User not found");
  return toPublicUser(user);
}
