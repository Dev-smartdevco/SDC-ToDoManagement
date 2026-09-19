import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { memberSchema, projectSchema } from "../validators/index.js";
import * as projectsService from "../services/projects.service.js";
import * as categoriesService from "../services/categories.service.js";
import * as membersService from "../services/members.service.js";
import * as filesService from "../services/files.service.js";
import { requireAuth, requireWrite, type AuthRequest } from "../middleware/auth.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const data = await projectsService.listProjects((req as AuthRequest).actor);
    res.json(data);
  }),
);

projectsRouter.post(
  "/",
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = projectSchema.parse(req.body);
    const data = await projectsService.createProject((req as AuthRequest).actor, body);
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
  "/:id/members",
  asyncHandler(async (req, res) => {
    const data = await membersService.listMembers((req as AuthRequest).actor, String(req.params.id));
    res.json(data);
  }),
);

projectsRouter.post(
  "/:id/members",
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = memberSchema.parse(req.body);
    const data = await membersService.addMember(
      (req as AuthRequest).actor,
      String(req.params.id),
      body.userId,
      body.role,
    );
    res.status(201).json(data);
  }),
);

projectsRouter.put(
  "/:id/members/:userId",
  requireWrite,
  asyncHandler(async (req, res) => {
    const role = req.body?.role === "OWNER" ? "OWNER" : "MEMBER";
    const data = await membersService.updateMemberRole(
      (req as AuthRequest).actor,
      String(req.params.id),
      String(req.params.userId),
      role,
    );
    res.json(data);
  }),
);

projectsRouter.delete(
  "/:id/members/:userId",
  requireWrite,
  asyncHandler(async (req, res) => {
    const data = await membersService.removeMember(
      (req as AuthRequest).actor,
      String(req.params.id),
      String(req.params.userId),
    );
    res.json(data);
  }),
);

projectsRouter.get(
  "/:id/files",
  asyncHandler(async (req, res) => {
    const data = await filesService.listProjectFiles((req as AuthRequest).actor, String(req.params.id));
    res.json(data);
  }),
);

projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await projectsService.getProject((req as AuthRequest).actor, String(req.params.id));
    res.json(data);
  }),
);

projectsRouter.put(
  "/:id",
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = projectSchema.partial().parse(req.body);
    const data = await projectsService.updateProject((req as AuthRequest).actor, String(req.params.id), body);
    res.json(data);
  }),
);

projectsRouter.delete(
  "/:id",
  requireWrite,
  asyncHandler(async (req, res) => {
    const data = await projectsService.deleteProject((req as AuthRequest).actor, String(req.params.id));
    res.json(data);
  }),
);
