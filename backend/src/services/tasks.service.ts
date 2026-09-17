import { Prisma, type Priority, type TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import { addDaysIso, todayIso } from "../lib/dates.js";

export type TaskView = "all" | "inbox" | "today" | "upcoming" | "overdue" | "completed";

function serializeTask<T extends { tags: { tag: { id: string; name: string } }[] }>(task: T) {
  const { tags, ...rest } = task;
  return { ...rest, tags: tags.map((t) => t.tag) };
}

async function syncTags(userId: string, taskId: string, names: string[]) {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const tags = await Promise.all(
    unique.map((name) =>
      prisma.tag.upsert({
        where: { userId_name: { userId, name } },
        update: {},
        create: { userId, name },
      }),
    ),
  );
  await prisma.taskTag.deleteMany({ where: { taskId } });
  if (tags.length) {
    await prisma.taskTag.createMany({
      data: tags.map((tag) => ({ taskId, tagId: tag.id })),
    });
  }
}

export function buildTaskWhere(userId: string, query: {
  view?: TaskView;
  projectId?: string;
  priority?: Priority;
  status?: TaskStatus;
  q?: string;
  date?: string;
}) {
  const today = query.date ?? todayIso();
  const where: Prisma.TaskWhereInput = { userId, parentTaskId: null };

  if (query.projectId) where.projectId = query.projectId;
  if (query.priority) where.priority = query.priority;
  if (query.status) where.status = query.status;
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { description: { contains: query.q, mode: "insensitive" } },
    ];
  }

  switch (query.view) {
    case "inbox":
      where.status = "INBOX";
      break;
    case "today":
      where.status = { notIn: ["DONE", "CANCELLED"] };
      where.dueDate = today;
      break;
    case "upcoming":
      where.status = { notIn: ["DONE", "CANCELLED"] };
      where.dueDate = { gt: today };
      break;
    case "overdue":
      where.status = { notIn: ["DONE", "CANCELLED"] };
      where.dueDate = { lt: today, not: null };
      break;
    case "completed":
      where.status = "DONE";
      break;
    default:
      break;
  }

  return where;
}

export async function listTasks(
  userId: string,
  query: {
    view?: TaskView;
    projectId?: string;
    priority?: Priority;
    status?: TaskStatus;
    q?: string;
    date?: string;
    page?: number;
    limit?: number;
  },
) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const where = buildTaskWhere(userId, query);

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        project: { select: { id: true, name: true, color: true, icon: true } },
        tags: { include: { tag: true } },
        _count: { select: { subtasks: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return {
    items: items.map(serializeTask),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getTask(userId: string, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, userId },
    include: {
      project: { select: { id: true, name: true, color: true, icon: true } },
      tags: { include: { tag: true } },
      subtasks: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { updatedAt: "desc" } },
    },
  });
  if (!task) throw errors.notFound("Task");
  return serializeTask(task);
}

export async function createTask(
  userId: string,
  data: {
    title: string;
    description?: string | null;
    projectId?: string | null;
    status?: TaskStatus;
    priority?: Priority;
    dueDate?: string | null;
    dueTime?: string | null;
    estimatedMinutes?: number | null;
    parentTaskId?: string | null;
    tags?: string[];
  },
) {
  const task = await prisma.task.create({
    data: {
      userId,
      title: data.title,
      description: data.description ?? null,
      projectId: data.projectId ?? null,
      status: data.status ?? (data.dueDate ? "TODO" : "INBOX"),
      priority: data.priority ?? "MEDIUM",
      dueDate: data.dueDate ?? null,
      dueTime: data.dueTime ?? null,
      estimatedMinutes: data.estimatedMinutes ?? null,
      parentTaskId: data.parentTaskId ?? null,
    },
  });
  if (data.tags?.length) await syncTags(userId, task.id, data.tags);
  return getTask(userId, task.id);
}

export async function updateTask(
  userId: string,
  id: string,
  data: {
    title?: string;
    description?: string | null;
    projectId?: string | null;
    status?: TaskStatus;
    priority?: Priority;
    dueDate?: string | null;
    dueTime?: string | null;
    estimatedMinutes?: number | null;
    snoozedUntil?: string | null;
    tags?: string[];
    actualMinutes?: number | null;
  },
) {
  const existing = await prisma.task.findFirst({ where: { id, userId } });
  if (!existing) throw errors.notFound("Task");

  const nextStatus = data.status ?? existing.status;
  const completedAt =
    nextStatus === "DONE" && existing.status !== "DONE"
      ? new Date()
      : nextStatus !== "DONE"
        ? null
        : existing.completedAt;

  await prisma.task.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      projectId: data.projectId,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      estimatedMinutes: data.estimatedMinutes,
      snoozedUntil: data.snoozedUntil,
      actualMinutes: data.actualMinutes,
      completedAt,
    },
  });

  if (data.tags) await syncTags(userId, id, data.tags);
  if (nextStatus === "DONE") {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.currentFocusTaskId === id) {
      await prisma.user.update({ where: { id: userId }, data: { currentFocusTaskId: null } });
    }
  }
  return getTask(userId, id);
}

export async function updateTaskStatus(userId: string, id: string, status: TaskStatus) {
  return updateTask(userId, id, { status });
}

export async function deleteTask(userId: string, id: string) {
  const existing = await prisma.task.findFirst({ where: { id, userId } });
  if (!existing) throw errors.notFound("Task");
  await prisma.task.delete({ where: { id } });
  return { ok: true };
}

export async function duplicateTask(userId: string, id: string) {
  const task = await getTask(userId, id);
  return createTask(userId, {
    title: `${task.title} (copy)`,
    description: task.description,
    projectId: task.projectId,
    status: "TODO",
    priority: task.priority,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    estimatedMinutes: task.estimatedMinutes,
    tags: task.tags.map((t) => t.name),
  });
}

export async function postponeTask(userId: string, id: string, date?: string) {
  const existing = await prisma.task.findFirst({ where: { id, userId } });
  if (!existing) throw errors.notFound("Task");
  const next = date ?? addDaysIso(existing.dueDate ?? todayIso(), 1);
  return updateTask(userId, id, {
    dueDate: next,
    status: existing.status === "INBOX" ? "TODO" : existing.status,
  });
}

export async function captureInbox(userId: string, title: string) {
  return createTask(userId, { title, status: "INBOX", priority: "MEDIUM" });
}
