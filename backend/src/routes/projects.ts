import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { projectSchema } from "../validators/index.js";
import * as projectsService from "../services/projects.service.js";
import * as categoriesService from "../services/categories.service.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const data = await projectsService.listProjects((req as AuthRequest).userId);
    res.json(data);
  }),
);

projectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = projectSchema.parse(req.body);
    const data = await projectsService.createProject((req as AuthRequest).userId, body);
    res.status(201).json(data);
  }),
);

projectsRouter.get(
  "/:id/categories",
  asyncHandler(async (req, res) => {
    const includeArchived = req.query.includeArchived === "true";
    const data = await categoriesService.listCategories(
      (req as AuthRequest).userId,
      String(req.params.id),
      includeArchived,
    );
    res.json(data);
  }),
);

projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await projectsService.getProject((req as AuthRequest).userId, String(req.params.id));
    res.json(data);
  }),
);

projectsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = projectSchema.partial().parse(req.body);
    const data = await projectsService.updateProject((req as AuthRequest).userId, String(req.params.id), body);
    res.json(data);
  }),
);

projectsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await projectsService.deleteProject((req as AuthRequest).userId, String(req.params.id));
    res.json(data);
  }),
);
