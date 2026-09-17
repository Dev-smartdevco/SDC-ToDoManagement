import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { timeBlockSchema } from "../validators/index.js";
import * as timeBlocksService from "../services/timeBlocks.service.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { todayIso } from "../lib/dates.js";

export const timeBlocksRouter = Router();
timeBlocksRouter.use(requireAuth);

timeBlocksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : todayIso();
    const data = await timeBlocksService.listTimeBlocks((req as AuthRequest).userId, date);
    res.json(data);
  }),
);

timeBlocksRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = timeBlockSchema.parse(req.body);
    const data = await timeBlocksService.createTimeBlock((req as AuthRequest).userId, body);
    res.status(201).json(data);
  }),
);

timeBlocksRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = timeBlockSchema.partial().parse(req.body);
    const data = await timeBlocksService.updateTimeBlock((req as AuthRequest).userId, String(req.params.id), body);
    res.json(data);
  }),
);

timeBlocksRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await timeBlocksService.deleteTimeBlock((req as AuthRequest).userId, String(req.params.id));
    res.json(data);
  }),
);
