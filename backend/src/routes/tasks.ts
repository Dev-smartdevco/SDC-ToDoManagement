import { Router } from "express";
import type { Priority, TaskStatus } from "@prisma/client";
import { asyncHandler } from "../lib/asyncHandler.js";
import { paginationSchema, taskReorderSchema, taskSchema, taskStatusSchema, taskUpdateSchema } from "../validators/index.js";
import * as tasksService from "../services/tasks.service.js";
import type { TaskView } from "../services/tasks.service.js";
import { requireAuth, requireWrite, type AuthRequest } from "../middleware/auth.js";
import { errors } from "../lib/httpError.js";
import { taskCollabRouter } from "./collaboration.js";
import * as commentsService from "../services/comments.service.js";
import { commentSchema } from "../validators/index.js";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const paging = paginationSchema.parse(req.query);
    const view = (req.query.view as TaskView | undefined) ?? "all";
    const data = await tasksService.listTasks((req as AuthRequest).actor, {
      view,
      projectId: typeof req.query.projectId === "string" ? req.query.projectId : undefined,
      categoryId: typeof req.query.categoryId === "string" ? req.query.categoryId : undefined,
      priority: req.query.priority as Priority | undefined,
      status: req.query.status as TaskStatus | undefined,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      date: typeof req.query.date === "string" ? req.query.date : undefined,
      dueDate: typeof req.query.dueDate === "string" ? req.query.dueDate : undefined,
      scope: req.query.scope === "team" ? "team" : "mine",
      assigneeId: typeof req.query.assigneeId === "string" ? req.query.assigneeId : undefined,
      page: paging.page,
      limit: paging.limit,
    });
    res.json(data);
  }),
);

tasksRouter.post(
  "/",
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = taskSchema.parse(req.body);
    const data = await tasksService.createTask((req as AuthRequest).actor, body);
    res.status(201).json(data);
  }),
);

tasksRouter.post(
  "/capture",
  requireWrite,
  asyncHandler(async (req, res) => {
    const title = String(req.body?.title ?? "").trim();
    if (!title) throw errors.badRequest("Title is required.");
    const data = await tasksService.captureInbox((req as AuthRequest).actor, title);
    res.status(201).json(data);
  }),
);

tasksRouter.post(
  "/reorder",
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = taskReorderSchema.parse(req.body);
    const data = await tasksService.reorderTasks((req as AuthRequest).actor, body.ids);
    res.json(data);
  }),
);

tasksRouter.use("/:id", taskCollabRouter);

tasksRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await tasksService.getTask((req as AuthRequest).actor, String(req.params.id));
    res.json(data);
  }),
);

tasksRouter.put(
  "/:id",
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = taskUpdateSchema.parse(req.body);
    const data = await tasksService.updateTask((req as AuthRequest).actor, String(req.params.id), body);
    res.json(data);
  }),
);

tasksRouter.patch(
  "/:id/status",
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = taskStatusSchema.parse(req.body);
    const data = await tasksService.updateTaskStatus(
      (req as AuthRequest).actor,
      String(req.params.id),
      body.status,
      body.blockedReason,
    );
    res.json(data);
  }),
);

tasksRouter.post(
  "/:id/duplicate",
  requireWrite,
  asyncHandler(async (req, res) => {
    const data = await tasksService.duplicateTask((req as AuthRequest).actor, String(req.params.id));
    res.status(201).json(data);
  }),
);

tasksRouter.post(
  "/:id/postpone",
  requireWrite,
  asyncHandler(async (req, res) => {
    const date = typeof req.body?.date === "string" ? req.body.date : undefined;
    const data = await tasksService.postponeTask((req as AuthRequest).actor, String(req.params.id), date);
    res.json(data);
  }),
);

tasksRouter.delete(
  "/:id",
  requireWrite,
  asyncHandler(async (req, res) => {
    const data = await tasksService.deleteTask((req as AuthRequest).actor, String(req.params.id));
    res.json(data);
  }),
);

export const commentsRouter = Router();
commentsRouter.use(requireAuth);

commentsRouter.put(
  "/:id",
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = commentSchema.parse(req.body);
    const data = await commentsService.updateComment((req as AuthRequest).actor, String(req.params.id), body.message);
    res.json(data);
  }),
);

commentsRouter.delete(
  "/:id",
  requireWrite,
  asyncHandler(async (req, res) => {
    const data = await commentsService.deleteComment((req as AuthRequest).actor, String(req.params.id));
    res.json(data);
  }),
);
