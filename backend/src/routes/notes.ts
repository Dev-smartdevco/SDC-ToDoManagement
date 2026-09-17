import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { noteSchema } from "../validators/index.js";
import * as notesService from "../services/notes.service.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const notesRouter = Router();
notesRouter.use(requireAuth);

notesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const data = await notesService.listNotes((req as AuthRequest).userId, {
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      projectId: typeof req.query.projectId === "string" ? req.query.projectId : undefined,
      categoryId: typeof req.query.categoryId === "string" ? req.query.categoryId : undefined,
      tag: typeof req.query.tag === "string" ? req.query.tag : undefined,
    });
    res.json(data);
  }),
);

notesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = noteSchema.parse(req.body);
    const data = await notesService.createNote((req as AuthRequest).userId, body);
    res.status(201).json(data);
  }),
);

notesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await notesService.getNote((req as AuthRequest).userId, String(req.params.id));
    res.json(data);
  }),
);

notesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = noteSchema.partial().parse(req.body);
    const data = await notesService.updateNote((req as AuthRequest).userId, String(req.params.id), body);
    res.json(data);
  }),
);

notesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await notesService.deleteNote((req as AuthRequest).userId, String(req.params.id));
    res.json(data);
  }),
);
