import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { smartNoteSaveSchema } from "../validators/index.js";
import * as notesService from "../services/notes.service.js";

export const smartNotesRouter = Router();
smartNotesRouter.use(requireAuth);

smartNotesRouter.post(
  "/save",
  asyncHandler(async (req, res) => {
    const data = smartNoteSaveSchema.parse(req.body);
    const result = await notesService.saveSmartNote((req as AuthRequest).actor, data);
    res.status(result.replayed ? 200 : 201).json(result);
  }),
);
