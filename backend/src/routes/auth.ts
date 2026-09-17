import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { loginSchema } from "../validators/index.js";
import * as authService from "../services/auth.service.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body.email, body.password);
    res.json(result);
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.me((req as AuthRequest).userId);
    res.json(user);
  }),
);
