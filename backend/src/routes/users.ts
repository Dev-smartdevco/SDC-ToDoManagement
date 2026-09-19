import { Router } from "express";
import type { UserRole } from "@prisma/client";
import { asyncHandler } from "../lib/asyncHandler.js";
import { createUserSchema, updateUserSchema } from "../validators/index.js";
import * as usersService from "../services/users.service.js";
import { requireAdmin, requireAuth, requireWrite, type AuthRequest } from "../middleware/auth.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get(
  "/directory",
  asyncHandler(async (req, res) => {
    const data = await usersService.directory((req as AuthRequest).actor);
    res.json(data);
  }),
);

usersRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const active =
      req.query.active === "true" ? true : req.query.active === "false" ? false : undefined;
    const data = await usersService.listUsers((req as AuthRequest).actor, {
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      role: req.query.role as UserRole | undefined,
      active,
    });
    res.json(data);
  }),
);

usersRouter.post(
  "/",
  requireAdmin,
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = createUserSchema.parse(req.body);
    const data = await usersService.createUser((req as AuthRequest).actor, body);
    res.status(201).json(data);
  }),
);

usersRouter.get(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = await usersService.getUser((req as AuthRequest).actor, String(req.params.id));
    res.json(data);
  }),
);

usersRouter.put(
  "/:id",
  requireAdmin,
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = updateUserSchema.parse(req.body);
    const data = await usersService.updateUser((req as AuthRequest).actor, String(req.params.id), body);
    res.json(data);
  }),
);

usersRouter.post(
  "/:id/activate",
  requireAdmin,
  requireWrite,
  asyncHandler(async (req, res) => {
    const data = await usersService.setUserActive((req as AuthRequest).actor, String(req.params.id), true);
    res.json(data);
  }),
);

usersRouter.post(
  "/:id/deactivate",
  requireAdmin,
  requireWrite,
  asyncHandler(async (req, res) => {
    const data = await usersService.setUserActive((req as AuthRequest).actor, String(req.params.id), false);
    res.json(data);
  }),
);

usersRouter.post(
  "/:id/reset-password",
  requireAdmin,
  requireWrite,
  asyncHandler(async (req, res) => {
    const data = await usersService.resetPassword((req as AuthRequest).actor, String(req.params.id));
    res.json(data);
  }),
);
