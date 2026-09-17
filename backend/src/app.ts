import type { IncomingMessage, ServerResponse } from "node:http";
import express from "express";
import cors from "cors";
import { env } from "./lib/env.js";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { tasksRouter } from "./routes/tasks.js";
import { notesRouter } from "./routes/notes.js";
import { timeBlocksRouter } from "./routes/timeBlocks.js";
import { focusRouter } from "./routes/focus.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "https://sdc-todomanagement.web.app",
  "https://sdc-todomanagement.firebaseapp.com",
];

function corsOrigin() {
  const allowed = [
    ...DEFAULT_ORIGINS,
    ...env.clientOrigin.split(",").map((value) => value.trim()).filter(Boolean),
  ];
  if (allowed.includes("*")) return true;
  return [...new Set(allowed)];
}

export function createApp() {
  const app = express();
  app.use(cors({ origin: corsOrigin(), credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, name: "MY OS API" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/notes", notesRouter);
  app.use("/api/time-blocks", timeBlocksRouter);
  app.use("/api/focus", focusRouter);
  app.use("/api/dashboard", dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  app(req, res);
}
