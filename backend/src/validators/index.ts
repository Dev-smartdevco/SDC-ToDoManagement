import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]).optional(),
  icon: z.string().trim().max(40).optional(),
  color: z.string().trim().max(20).optional(),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(8000).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  status: z.enum(["INBOX", "TODO", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  estimatedMinutes: z.number().int().min(0).max(24 * 60).optional().nullable(),
  parentTaskId: z.string().uuid().optional().nullable(),
  snoozedUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).optional(),
});

export const taskUpdateSchema = taskSchema.partial();

export const taskStatusSchema = z.object({
  status: z.enum(["INBOX", "TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
});

export const noteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(20000).optional().default(""),
  projectId: z.string().uuid().optional().nullable(),
  taskId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).optional(),
});

export const timeBlockSchema = z.object({
  title: z.string().trim().min(1).max(120),
  projectId: z.string().uuid().optional().nullable(),
  taskId: z.string().uuid().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(2000).optional().nullable(),
});

export const focusStartSchema = z.object({
  taskId: z.string().uuid(),
});

export const dailyReviewSchema = z.object({
  notes: z.string().max(4000).optional().nullable(),
});
