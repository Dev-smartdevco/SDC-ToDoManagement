import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { dailyReviewSchema } from "../validators/index.js";
import * as dashboardService from "../services/dashboard.service.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { todayIso } from "../lib/dates.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get(
  "/today",
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : todayIso();
    const data = await dashboardService.getTodayDashboard((req as AuthRequest).userId, date);
    res.json(data);
  }),
);

dashboardRouter.get(
  "/review",
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : todayIso();
    const data = await dashboardService.getWeekReview((req as AuthRequest).userId, date);
    res.json(data);
  }),
);

dashboardRouter.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const data = await dashboardService.getTaskStats((req as AuthRequest).userId, {
      projectId: typeof req.query.projectId === "string" ? req.query.projectId : undefined,
      categoryId: typeof req.query.categoryId === "string" ? req.query.categoryId : undefined,
    });
    res.json(data);
  }),
);

dashboardRouter.put(
  "/review/:date",
  asyncHandler(async (req, res) => {
    const body = dailyReviewSchema.parse(req.body);
    const data = await dashboardService.updateReviewNotes(
      (req as AuthRequest).userId,
      String(req.params.date),
      body.notes ?? null,
    );
    res.json(data);
  }),
);
