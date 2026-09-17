import { Router } from "express";
import type { Priority, TaskStatus } from "@prisma/client";
import { asyncHandler } from "../lib/asyncHandler.js";
import { paginationSchema, taskReorderSchema, taskSchema, taskStatusSchema, taskUpdateSchema } from "../validators/index.js";
import * as tasksService from "../services/tasks.service.js";
import type { TaskView } from "../services/tasks.service.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { errors } from "../lib/httpError.js";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const paging = paginationSchema.parse(req.query);
    const view = (req.query.view as TaskView | undefined) ?? "all";
    const data = await tasksService.listTasks((req as AuthRequest).userId, {
      view,
      projectId: typeof req.query.projectId === "string" ? req.query.projectId : undefined,
      categoryId: typeof req.query.categoryId === "string" ? req.query.categoryId : undefined,
      priority: req.query.priority as Priority | undefined,
      status: req.query.status as TaskStatus | undefined,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      date: typeof req.query.date === "string" ? req.query.date : undefined,
      dueDate: typeof req.query.dueDate === "string" ? req.query.dueDate : undefined,
      page: paging.page,
      limit: paging.limit,
    });
    res.json(data);
  }),
);

tasksRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = taskSchema.parse(req.body);
    const data = await tasksService.createTask((req as AuthRequest).userId, body);
    res.status(201).json(data);
  }),
);

tasksRouter.post(
  "/capture",
  asyncHandler(async (req, res) => {
    const title = String(req.body?.title ?? "").trim();
    if (!title) throw errors.badRequest("Title is required.");
    const data = await tasksService.captureInbox((req as AuthRequest).userId, title);
    res.status(201).json(data);
  }),
);

tasksRouter.post(
  "/reorder",
  asyncHandler(async (req, res) => {
    const body = taskReorderSchema.parse(req.body);
    const data = await tasksService.reorderTasks((req as AuthRequest).userId, body.ids);
    res.json(data);
  }),
);

tasksRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await tasksService.getTask((req as AuthRequest).userId, String(req.params.id));
    res.json(data);
  }),
);

tasksRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = taskUpdateSchema.parse(req.body);
    const data = await tasksService.updateTask((req as AuthRequest).userId, String(req.params.id), body);
    res.json(data);
  }),
);

tasksRouter.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const body = taskStatusSchema.parse(req.body);
    const data = await tasksService.updateTaskStatus((req as AuthRequest).userId, String(req.params.id), body.status);
    res.json(data);
  }),
);

tasksRouter.post(
  "/:id/duplicate",
  asyncHandler(async (req, res) => {
    const data = await tasksService.duplicateTask((req as AuthRequest).userId, String(req.params.id));
    res.status(201).json(data);
  }),
);

tasksRouter.post(
  "/:id/postpone",
  asyncHandler(async (req, res) => {
    const date = typeof req.body?.date === "string" ? req.body.date : undefined;
    const data = await tasksService.postponeTask((req as AuthRequest).userId, String(req.params.id), date);
    res.json(data);
  }),
);

tasksRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await tasksService.deleteTask((req as AuthRequest).userId, String(req.params.id));
    res.json(data);
  }),
);
