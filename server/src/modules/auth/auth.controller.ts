import type { Request, Response } from "express";
import { asyncHandler, AppError } from "../../middleware/errorHandler.js";
import { env, isProd } from "../../env.js";
import * as authService from "./auth.service.js";

const REFRESH_COOKIE = "refreshToken";

// The refresh token lives in an httpOnly cookie scoped to the auth routes,
// so it is never exposed to client-side JavaScript.
const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/api/auth",
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.registerUser(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
  res.status(201).json({ user, accessToken });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.loginUser(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
  res.json({ user, accessToken });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) throw new AppError(401, "No refresh token provided");
  const { user, accessToken, refreshToken } = await authService.rotateRefreshToken(token);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
  res.json({ user, accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (token) await authService.revokeRefreshToken(token);
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  res.json({ message: "Logged out successfully" });
});
