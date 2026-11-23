import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
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
  isDefault: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  projectId: z.string().uuid(),
  description: z.string().trim().max(2000).optional().nullable(),
  icon: z.string().trim().max(40).optional(),
  color: z.string().trim().max(20).optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  archived: z.boolean().optional(),
});

export const categoryUpdateSchema = categorySchema.omit({ projectId: true }).partial();

export const categoryDeleteSchema = z.object({
  moveToCategoryId: z.string().uuid().optional().nullable(),
  unassign: z.boolean().optional(),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(8000).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  status: z.enum(["INBOX", "TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  estimatedMinutes: z.number().int().min(0).max(24 * 60).optional().nullable(),
  parentTaskId: z.string().uuid().optional().nullable(),
  snoozedUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).optional(),
  subtasks: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(200),
        status: z.enum(["INBOX", "TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]).optional(),
      }),
    )
    .max(50)
    .optional(),
  assigneeIds: z.preprocess((value) => {
    if (!Array.isArray(value)) return value;
    return value.filter((item) => typeof item === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item));
  }, z.array(z.string().uuid()).max(20).optional()),
  blockedReason: z.string().trim().max(500).optional().nullable(),
  actualMinutes: z.number().int().min(0).max(24 * 60 * 30).optional().nullable(),
});

export const taskUpdateSchema = taskSchema.partial();

export const taskStatusSchema = z.object({
  status: z.enum(["INBOX", "TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]),
  blockedReason: z.string().trim().max(500).optional().nullable(),
});

export const taskReorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

export const noteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(20000).optional().default(""),
  projectId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  taskId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).optional(),
  sharedWith: z.array(z.string().uuid()).max(50).optional(),
});

export const smartNoteSaveSchema = z.object({
  requestId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  content: z.string().max(20000),
  projectId: z.string().uuid(),
  originalDrawing: z.record(z.string(), z.unknown()).optional(),
  saveNote: z.boolean().default(false),
  createTasks: z.boolean().default(false),
  tasks: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    level: z.number().int().min(0).max(1),
  })).max(100).default([]),
}).refine((data) => !data.createTasks || data.tasks.length > 0, { message: "At least one task is required." })
  .refine((data) => data.saveNote || data.createTasks, { message: "Choose at least one save option." })
  .refine((data) => Buffer.byteLength(JSON.stringify(data.originalDrawing ?? {}), "utf8") <= 700_000,
    { message: "Drawing data is too large." });

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

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(100),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "MEMBER", "VIEWER"]).optional(),
  password: z.string().min(8).max(100).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().email().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "MEMBER", "VIEWER"]).optional(),
});

export const memberSchema = z.object({
  userId: z.string().trim().min(1).max(64),
  role: z.enum(["OWNER", "MEMBER"]).optional(),
});

export const commentSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

export const fileLinkSchema = z.object({
  title: z.string().trim().min(1).max(120),
  url: z.string().url().max(2000),
  projectId: z.string().trim().min(1).max(64).optional().nullable(),
  taskId: z.string().trim().min(1).max(64).optional().nullable(),
});

export const recognitionSchema = z.object({
  recipientId: z.string().trim().min(1).max(64),
  message: z.string().trim().min(1).max(2000),
  projectId: z.string().trim().min(1).max(64).optional().nullable(),
  taskId: z.string().trim().min(1).max(64).optional().nullable(),
  visibility: z.enum(["EVERYONE", "TEAM", "PROJECT"]).optional(),
});

export const timeLogSchema = z.object({
  minutes: z.number().int().min(1).max(24 * 60),
});

export const settingSchema = z.object({
  key: z.string().trim().min(1).max(80),
  value: z.string().max(4000),
});

export const rewardRuleUpdateSchema = z.object({
  points: z.number().int().min(0).max(10000).optional(),
  active: z.boolean().optional(),
});
