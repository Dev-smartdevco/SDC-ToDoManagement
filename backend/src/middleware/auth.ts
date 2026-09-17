import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { errors } from "../lib/httpError.js";
import { verifyToken } from "../lib/jwt.js";

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
    (req as AuthRequest).userId = payload.sub;
    (req as AuthRequest).userEmail = payload.email;
    next();
  } catch {
    throw errors.unauthorized();
  }
});
