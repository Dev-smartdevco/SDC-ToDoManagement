import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { errors } from "../lib/httpError.js";
import { verifyToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

export type AuthRequest = Request & {
  userId: string;
  userEmail: string;
};

export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw errors.unauthorized();

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true } });
    if (!user) throw errors.unauthorized();
    (req as AuthRequest).userId = user.id;
    (req as AuthRequest).userEmail = user.email;
    next();
  } catch {
    throw errors.unauthorized();
  }
});
