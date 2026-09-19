import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth, requireWrite, type AuthRequest } from "../middleware/auth.js";
import { commentSchema, fileLinkSchema, recognitionSchema, rewardRuleUpdateSchema, settingSchema, timeLogSchema } from "../validators/index.js";
import * as commentsService from "../services/comments.service.js";
import * as filesService from "../services/files.service.js";
import * as notificationsService from "../services/notifications.service.js";
import * as recognitionService from "../services/recognition.service.js";
import * as rewardsService from "../services/rewards.service.js";
import * as teamService from "../services/team.service.js";
import * as calendarService from "../services/calendar.service.js";
import * as analyticsService from "../services/analytics.service.js";
import * as tasksService from "../services/tasks.service.js";
import { requireAdmin } from "../middleware/auth.js";
import type { TaskStatus } from "@prisma/client";

export const collaborationRouter = Router();
collaborationRouter.use(requireAuth);

collaborationRouter.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const data = await notificationsService.listNotifications((req as AuthRequest).actor, req.query.unread === "true");
    res.json(data);
  }),
);

collaborationRouter.get(
  "/notifications/unread-count",
  asyncHandler(async (req, res) => {
    const data = await notificationsService.unreadCount((req as AuthRequest).actor);
    res.json(data);
  }),
);

collaborationRouter.post(
  "/notifications/read-all",
  asyncHandler(async (req, res) => {
    const data = await notificationsService.markAllRead((req as AuthRequest).actor);
    res.json(data);
  }),
);

collaborationRouter.post(
  "/notifications/:id/read",
  asyncHandler(async (req, res) => {
    const data = await notificationsService.markRead((req as AuthRequest).actor, String(req.params.id));
    res.json(data);
  }),
);

collaborationRouter.get(
  "/team",
  asyncHandler(async (req, res) => {
    const data = await teamService.teamDashboard((req as AuthRequest).actor);
    res.json(data);
  }),
);

collaborationRouter.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const data = await teamService.listActivity((req as AuthRequest).actor, {
      projectId: typeof req.query.projectId === "string" ? req.query.projectId : undefined,
      taskId: typeof req.query.taskId === "string" ? req.query.taskId : undefined,
    });
    res.json(data);
  }),
);

collaborationRouter.get(
  "/calendar",
  asyncHandler(async (req, res) => {
    const data = await calendarService.calendar((req as AuthRequest).actor, {
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      scope: req.query.scope === "team" ? "team" : "mine",
      projectId: typeof req.query.projectId === "string" ? req.query.projectId : undefined,
      memberId: typeof req.query.memberId === "string" ? req.query.memberId : undefined,
      status: req.query.status as TaskStatus | undefined,
    });
    res.json(data);
  }),
);

collaborationRouter.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    const data = await analyticsService.analytics(
      (req as AuthRequest).actor,
      typeof req.query.projectId === "string" ? req.query.projectId : undefined,
    );
    res.json(data);
  }),
);

collaborationRouter.get(
  "/recognition",
  asyncHandler(async (req, res) => {
    const data = await recognitionService.listRecognition(
      (req as AuthRequest).actor,
      typeof req.query.projectId === "string" ? req.query.projectId : undefined,
    );
    res.json(data);
  }),
);

collaborationRouter.post(
  "/recognition",
  requireAdmin,
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = recognitionSchema.parse(req.body);
    const data = await recognitionService.createRecognition((req as AuthRequest).actor, body);
    res.status(201).json(data);
  }),
);

collaborationRouter.get(
  "/rewards",
  asyncHandler(async (req, res) => {
    const data = await rewardsService.listAchievements((req as AuthRequest).userId);
    res.json(data);
  }),
);

collaborationRouter.get(
  "/reward-rules",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const data = await rewardsService.listRewardRules();
    res.json(data);
  }),
);

collaborationRouter.put(
  "/reward-rules/:id",
  requireAdmin,
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = rewardRuleUpdateSchema.parse(req.body);
    const data = await rewardsService.updateRewardRule(String(req.params.id), body);
    res.json(data);
  }),
);

collaborationRouter.get(
  "/settings",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = await analyticsService.getSettings((req as AuthRequest).actor);
    res.json(data);
  }),
);

collaborationRouter.put(
  "/settings",
  requireAdmin,
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = settingSchema.parse(req.body);
    const data = await analyticsService.setSetting(body.key, body.value);
    res.json(data);
  }),
);

collaborationRouter.post(
  "/files",
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = fileLinkSchema.parse(req.body);
    const data = await filesService.addFile((req as AuthRequest).actor, body);
    res.status(201).json(data);
  }),
);

collaborationRouter.delete(
  "/files/:id",
  requireWrite,
  asyncHandler(async (req, res) => {
    const data = await filesService.deleteFile((req as AuthRequest).actor, String(req.params.id));
    res.json(data);
  }),
);

export const taskCollabRouter = Router({ mergeParams: true });
taskCollabRouter.use(requireAuth);

taskCollabRouter.get(
  "/comments",
  asyncHandler(async (req, res) => {
    const data = await commentsService.listComments((req as AuthRequest).actor, String(req.params.id));
    res.json(data);
  }),
);

taskCollabRouter.post(
  "/comments",
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = commentSchema.parse(req.body);
    const data = await commentsService.addComment((req as AuthRequest).actor, String(req.params.id), body.message);
    res.status(201).json(data);
  }),
);

taskCollabRouter.get(
  "/files",
  asyncHandler(async (req, res) => {
    const data = await filesService.listTaskFiles((req as AuthRequest).actor, String(req.params.id));
    res.json(data);
  }),
);

taskCollabRouter.post(
  "/time",
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = timeLogSchema.parse(req.body);
    const data = await tasksService.logTime((req as AuthRequest).actor, String(req.params.id), body.minutes);
    res.json(data);
  }),
);
