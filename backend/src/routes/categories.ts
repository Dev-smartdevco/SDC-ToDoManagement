import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { categoryDeleteSchema, categorySchema, categoryUpdateSchema } from "../validators/index.js";
import * as categoriesService from "../services/categories.service.js";
import { requireAuth, requireWrite, type AuthRequest } from "../middleware/auth.js";

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

categoriesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const includeArchived = req.query.includeArchived === "true";
    const data = await categoriesService.listCategories((req as AuthRequest).actor, projectId, includeArchived);
    res.json(data);
  }),
);

categoriesRouter.post(
  "/",
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = categorySchema.parse(req.body);
    const data = await categoriesService.createCategory((req as AuthRequest).actor, body);
    res.status(201).json(data);
  }),
);

categoriesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await categoriesService.getCategory((req as AuthRequest).actor, String(req.params.id));
    res.json(data);
  }),
);

categoriesRouter.put(
  "/:id",
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = categoryUpdateSchema.parse(req.body);
    const data = await categoriesService.updateCategory((req as AuthRequest).actor, String(req.params.id), body);
    res.json(data);
  }),
);

categoriesRouter.delete(
  "/:id",
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = categoryDeleteSchema.parse(req.body ?? {});
    const data = await categoriesService.deleteCategory((req as AuthRequest).actor, String(req.params.id), body);
    res.json(data);
  }),
);
