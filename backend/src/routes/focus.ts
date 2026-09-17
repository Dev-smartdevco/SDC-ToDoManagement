import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { focusStartSchema } from "../validators/index.js";
import * as focusService from "../services/focus.service.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const focusRouter = Router();
focusRouter.use(requireAuth);

focusRouter.get(
  "/active",
  asyncHandler(async (req, res) => {
    const data = await focusService.getActiveSession((req as AuthRequest).userId);
    res.json(data);
  }),
);

focusRouter.post(
  "/start",
  asyncHandler(async (req, res) => {
    const body = focusStartSchema.parse(req.body);
    const data = await focusService.startFocus((req as AuthRequest).userId, body.taskId);
    res.status(201).json(data);
  }),
);

focusRouter.post(
  "/:id/pause",
  asyncHandler(async (req, res) => {
    const data = await focusService.pauseFocus((req as AuthRequest).userId, String(req.params.id));
    res.json(data);
  }),
);

focusRouter.post(
  "/:id/resume",
  asyncHandler(async (req, res) => {
    const data = await focusService.resumeFocus((req as AuthRequest).userId, String(req.params.id));
    res.json(data);
  }),
);

focusRouter.post(
  "/:id/complete",
  asyncHandler(async (req, res) => {
    const completeTask = Boolean(req.body?.completeTask);
    const data = await focusService.completeFocus((req as AuthRequest).userId, String(req.params.id), completeTask);
    res.json(data);
  }),
);

focusRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const data = await focusService.cancelFocus((req as AuthRequest).userId, String(req.params.id));
    res.json(data);
  }),
);
