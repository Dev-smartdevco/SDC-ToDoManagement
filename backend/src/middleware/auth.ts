import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { errors } from "../lib/httpError.js";
import { verifyToken } from "../lib/jwt.js";
import { loadActor, type Actor } from "../lib/access.js";

export type AuthRequest = Request & {
  userId: string;
  userEmail: string;
  actor: Actor;
};

export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw errors.unauthorized();

  try {
    const payload = verifyToken(token);
    const actor = await loadActor(payload.sub);
    (req as AuthRequest).userId = actor.id;
    (req as AuthRequest).userEmail = actor.email;
    (req as AuthRequest).actor = actor;
    next();
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error;
    throw errors.unauthorized();
  }
});

export const requireAdmin = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const actor = (req as AuthRequest).actor;
  if (!actor || (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN")) {
    throw errors.forbidden();
  }
  next();
});

export const requireWrite = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const actor = (req as AuthRequest).actor;
  if (actor?.role === "VIEWER") throw errors.forbidden();
  next();
});
