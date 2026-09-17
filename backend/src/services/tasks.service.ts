import { Prisma, type Priority, type TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import { addDaysIso, todayIso } from "../lib/dates.js";
import { assertCategoryForProject, categorySelect, projectSelect } from "../lib/category.js";
import { parentStatusFromSubtasks, serializeTaggedTask } from "../lib/taskProgress.js";

export type TaskView = "all" | "inbox" | "today" | "upcoming" | "overdue" | "completed";

const subtaskSelect = {
  id: true,
  title: true,
  status: true,
  completedAt: true,
} as const;

const taskInclude = {
  project: { select: projectSelect },
  category: { select: categorySelect },
  tags: { include: { tag: true } },
  subtasks: { select: subtaskSelect, orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
};

function serializeTask<T extends { tags: { tag: { id: string; name: string } }[]; subtasks?: { id: string; title: string; status: string }[] }>(task: T) {
  return serializeTaggedTask(task);
}

async function applyParentProgress(userId: string, parentId: string | null | undefined) {
  if (!parentId) return;
  const parent = await prisma.task.findFirst({ where: { id: parentId, userId } });
  if (!parent || parent.status === "CANCELLED") return;
  const subtasks = await prisma.task.findMany({
    where: { parentTaskId: parentId, userId },
    select: { status: true },
  });
  const nextStatus = parentStatusFromSubtasks(parent.status, subtasks);
  if (!nextStatus || nextStatus === parent.status) return;
  await prisma.task.update({
    where: { id: parentId },
    data: {
      status: nextStatus,
      completedAt: nextStatus === "DONE" ? new Date() : null,
    },
  });
  if (nextStatus === "DONE") {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { currentFocusTaskId: true } });
    if (user?.currentFocusTaskId === parentId) {
      await prisma.user.update({ where: { id: userId }, data: { currentFocusTaskId: null } });
    }
  }
}

async function syncChecklist(
  userId: string,
  parentId: string,
  items: { id?: string; title: string; status?: TaskStatus }[],
) {
  const parent = await prisma.task.findFirst({ where: { id: parentId, userId } });
  if (!parent) throw errors.notFound("Task");

  const cleaned = items
    .map((item) => ({ ...item, title: item.title.trim() }))
    .filter((item) => item.title);

  const existing = await prisma.task.findMany({ where: { parentTaskId: parentId, userId } });
  const keepIds = new Set(cleaned.map((item) => item.id).filter((id): id is string => Boolean(id)));
  const removing = existing.filter((item) => !keepIds.has(item.id));
  if (removing.length) {
    await prisma.task.deleteMany({ where: { id: { in: removing.map((item) => item.id) } } });
  }

  for (const [index, item] of cleaned.entries()) {
    if (item.id && existing.some((row) => row.id === item.id)) {
      await prisma.task.update({
        where: { id: item.id },
        data: {
          title: item.title,
          sortOrder: index,
          ...(item.status
            ? { status: item.status, completedAt: item.status === "DONE" ? new Date() : null }
            : {}),
        },
      });
      continue;
    }
    await prisma.task.create({
      data: {
        userId,
        title: item.title,
        parentTaskId: parentId,
        projectId: parent.projectId,
        categoryId: parent.categoryId,
        status: item.status ?? "TODO",
        priority: "MEDIUM",
        sortOrder: index,
        completedAt: item.status === "DONE" ? new Date() : null,
      },
    });
  }

  await applyParentProgress(userId, parentId);
}

async function nextSortOrder(userId: string, parentTaskId: string | null) {
  const agg = await prisma.task.aggregate({
    where: { userId, parentTaskId },
    _max: { sortOrder: true },
  });
  return (agg._max.sortOrder ?? -1) + 1;
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

async function cascadeParentStatus(userId: string, parentId: string, status: TaskStatus, previous: TaskStatus) {
  if (status === "DONE" && previous !== "DONE") {
    await prisma.task.updateMany({
      where: { parentTaskId: parentId, userId, status: { not: "CANCELLED" } },
      data: { status: "DONE", completedAt: new Date() },
    });
  }
  if (status !== "DONE" && previous === "DONE") {
    await prisma.task.updateMany({
      where: { parentTaskId: parentId, userId, status: "DONE" },
      data: { status: "TODO", completedAt: null },
    });
  }
}

export function buildTaskWhere(
  userId: string,
  query: {
    view?: TaskView;
    projectId?: string;
    categoryId?: string;
    priority?: Priority;
    status?: TaskStatus;
    q?: string;
    date?: string;
    dueDate?: string;
  },
) {
  const today = query.date ?? todayIso();
  const where: Prisma.TaskWhereInput = { userId, parentTaskId: null };

  if (query.projectId) where.projectId = query.projectId;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.priority) where.priority = query.priority;
  if (query.status) where.status = query.status;
  if (query.dueDate) where.dueDate = query.dueDate;
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { description: { contains: query.q, mode: "insensitive" } },
      { project: { name: { contains: query.q, mode: "insensitive" } } },
      { category: { name: { contains: query.q, mode: "insensitive" } } },
      { notes: { some: { OR: [{ title: { contains: query.q, mode: "insensitive" } }, { content: { contains: query.q, mode: "insensitive" } }] } } },
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
    categoryId?: string;
    priority?: Priority;
    status?: TaskStatus;
    q?: string;
    date?: string;
    dueDate?: string;
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
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: taskInclude,
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
      ...taskInclude,
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
    categoryId?: string | null;
    status?: TaskStatus;
    priority?: Priority;
    dueDate?: string | null;
    dueTime?: string | null;
    estimatedMinutes?: number | null;
    parentTaskId?: string | null;
    tags?: string[];
    subtasks?: { id?: string; title: string; status?: TaskStatus }[];
  },
) {
  await assertCategoryForProject(userId, data.categoryId, data.projectId ?? null);
  const sortOrder = await nextSortOrder(userId, data.parentTaskId ?? null);
  const task = await prisma.task.create({
    data: {
      userId,
      title: data.title,
      description: data.description ?? null,
      projectId: data.projectId ?? null,
      categoryId: data.categoryId ?? null,
      status: data.status ?? (data.dueDate ? "TODO" : "INBOX"),
      priority: data.priority ?? "MEDIUM",
      dueDate: data.dueDate ?? null,
      dueTime: data.dueTime ?? null,
      estimatedMinutes: data.estimatedMinutes ?? null,
      parentTaskId: data.parentTaskId ?? null,
      sortOrder,
    },
  });
  if (data.tags?.length) await syncTags(userId, task.id, data.tags);
  if (data.subtasks?.length) await syncChecklist(userId, task.id, data.subtasks);
  if (data.parentTaskId) await applyParentProgress(userId, data.parentTaskId);
  return getTask(userId, task.id);
}

export async function updateTask(
  userId: string,
  id: string,
  data: {
    title?: string;
    description?: string | null;
    projectId?: string | null;
    categoryId?: string | null;
    status?: TaskStatus;
    priority?: Priority;
    dueDate?: string | null;
    dueTime?: string | null;
    estimatedMinutes?: number | null;
    snoozedUntil?: string | null;
    tags?: string[];
    subtasks?: { id?: string; title: string; status?: TaskStatus }[];
    actualMinutes?: number | null;
  },
) {
  const existing = await prisma.task.findFirst({ where: { id, userId } });
  if (!existing) throw errors.notFound("Task");

  const nextProjectId = data.projectId !== undefined ? data.projectId : existing.projectId;
  let nextCategoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
  if (data.projectId !== undefined && data.projectId !== existing.projectId && data.categoryId === undefined) {
    nextCategoryId = null;
  }
  await assertCategoryForProject(userId, nextCategoryId, nextProjectId);

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
      categoryId: nextCategoryId,
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

  if (data.projectId !== undefined || data.categoryId !== undefined) {
    await prisma.task.updateMany({
      where: { parentTaskId: id, userId },
      data: { projectId: nextProjectId, categoryId: nextCategoryId },
    });
  }

  if (data.tags) await syncTags(userId, id, data.tags);
  if (data.subtasks) await syncChecklist(userId, id, data.subtasks);
  if (data.status && !existing.parentTaskId && !data.subtasks) {
    await cascadeParentStatus(userId, id, nextStatus, existing.status);
  }
  if (existing.parentTaskId && (data.status || data.title)) {
    await applyParentProgress(userId, existing.parentTaskId);
  }
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
  const parentId = existing.parentTaskId;
  await prisma.task.delete({ where: { id } });
  if (parentId) await applyParentProgress(userId, parentId);
  return { ok: true };
}

export async function duplicateTask(userId: string, id: string) {
  const task = await getTask(userId, id);
  return createTask(userId, {
    title: `${task.title} (copy)`,
    description: task.description,
    projectId: task.projectId,
    categoryId: task.categoryId,
    status: "TODO",
    priority: task.priority,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    estimatedMinutes: task.estimatedMinutes,
    tags: task.tags.map((t) => t.name),
    subtasks: task.subtasks.map((item) => ({ title: item.title, status: "TODO" as const })),
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

export async function reorderTasks(userId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) throw errors.badRequest("Task ids must be unique.");
  const existing = await prisma.task.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true, sortOrder: true },
  });
  if (existing.length !== ids.length) throw errors.badRequest("Invalid tasks.");

  const current = new Map(existing.map((task) => [task.id, task.sortOrder]));
  const ranks = ids.map((id) => current.get(id) ?? 0).sort((a, b) => a - b);
  const distinct = new Set(ranks);
  const nextRanks = distinct.size === ids.length ? ranks : ids.map((_, index) => (ranks[0] ?? 0) + index);

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.task.update({
        where: { id },
        data: { sortOrder: nextRanks[index] },
      }),
    ),
  );
  return { ok: true };
}
