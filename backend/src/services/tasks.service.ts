import { Prisma, type Priority, type TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import { addDaysIso, todayIso } from "../lib/dates.js";
import { assertCategoryForProject, categorySelect, projectSelect } from "../lib/category.js";
import { parentStatusFromSubtasks, serializeTaggedTask } from "../lib/taskProgress.js";
import {
  getUserDefaultProjectId,
  sortByUserDefaultProject,
  withNestedProjectDefaultFlag,
} from "../lib/defaultProject.js";
import {
  assertWrite,
  getAccessibleTask,
  myTaskWhere,
  publicUserSelect,
  taskAccessWhere,
  type Actor,
} from "../lib/access.js";
import { actorName, notifyUsers, recordActivity } from "../lib/events.js";
import { pageResult, pageWindow } from "../lib/paging.js";
import { invalidateReadCache } from "../lib/readCache.js";
import { onTaskCompleted } from "./rewards.service.js";

export type TaskView = "all" | "inbox" | "today" | "upcoming" | "overdue" | "completed" | "blocked";

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
  assignees: { include: { user: { select: publicUserSelect } } },
  blockedBy: { select: publicUserSelect },
};

function serializeTask<
  T extends {
    tags: { tag: { id: string; name: string } }[];
    subtasks?: { id: string; title: string; status: string }[];
    assignees?: { isPrimary: boolean; user: { id: string; name: string; email: string; role: string } }[];
    project?: { id: string } | null;
  },
>(task: T, defaultProjectId: string | null = null) {
  const base = serializeTaggedTask(task);
  return withNestedProjectDefaultFlag(
    {
      ...base,
      assignees: (task.assignees ?? []).map((row) => ({ ...row.user, isPrimary: row.isPrimary })),
    },
    defaultProjectId,
  );
}

async function applyParentProgress(userId: string, parentId: string | null | undefined) {
  if (!parentId) return;
  const parent = await prisma.task.findFirst({ where: { id: parentId } });
  if (!parent || parent.status === "CANCELLED") return;
  const subtasks = await prisma.task.findMany({
    where: { parentTaskId: parentId },
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
  const parent = await prisma.task.findFirst({ where: { id: parentId } });
  if (!parent) throw errors.notFound("Task");

  const cleaned = items
    .map((item) => ({ ...item, title: item.title.trim() }))
    .filter((item) => item.title);

  const existing = await prisma.task.findMany({ where: { parentTaskId: parentId } });
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
    _min: { sortOrder: true },
  });
  // Newer tasks get a lower sortOrder so they appear first (ASC list = newest on top).
  return (agg._min.sortOrder ?? 0) - 1;
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
      where: { parentTaskId: parentId, status: { not: "CANCELLED" } },
      data: { status: "DONE", completedAt: new Date() },
    });
  }
  if (status !== "DONE" && previous === "DONE") {
    await prisma.task.updateMany({
      where: { parentTaskId: parentId, status: "DONE" },
      data: { status: "TODO", completedAt: null },
    });
  }
}

async function syncAssignees(taskId: string, ownerId: string, ids?: string[]) {
  const unique = [...new Set(ids ?? [ownerId])].filter((id) => id.length > 0);
  await prisma.taskAssignee.deleteMany({ where: { taskId } });
  if (unique.length) {
    const primary = unique.includes(ownerId) ? ownerId : unique[0];
    await prisma.taskAssignee.createMany({
      data: unique.map((userId) => ({ taskId, userId, isPrimary: userId === primary })),
    });
  }
  return unique;
}

export function buildTaskWhere(
  actor: Actor,
  query: {
    view?: TaskView;
    projectId?: string;
    categoryId?: string;
    priority?: Priority;
    status?: TaskStatus;
    q?: string;
    date?: string;
    dueDate?: string;
    scope?: "mine" | "team";
    assigneeId?: string;
  },
) {
  const today = query.date ?? todayIso();
  const access = query.scope === "team" ? taskAccessWhere(actor) : myTaskWhere(actor);
  const where: Prisma.TaskWhereInput = {
    parentTaskId: null,
    AND: [access],
  };

  if (query.projectId) where.projectId = query.projectId;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.priority) where.priority = query.priority;
  if (query.status) where.status = query.status;
  if (query.dueDate) where.dueDate = query.dueDate;
  if (query.assigneeId) {
    (where.AND as Prisma.TaskWhereInput[]).push({
      OR: [{ userId: query.assigneeId }, { assignees: { some: { userId: query.assigneeId } } }],
    });
  }
  if (query.q) {
    (where.AND as Prisma.TaskWhereInput[]).push({
      OR: [
        { title: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
        { project: { name: { contains: query.q, mode: "insensitive" } } },
        { category: { name: { contains: query.q, mode: "insensitive" } } },
      ],
    });
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
    case "blocked":
      where.status = "BLOCKED";
      break;
    default:
      break;
  }

  return where;
}

export async function listTasks(
  actor: Actor,
  query: {
    view?: TaskView;
    projectId?: string;
    categoryId?: string;
    priority?: Priority;
    status?: TaskStatus;
    q?: string;
    date?: string;
    dueDate?: string;
    scope?: "mine" | "team";
    assigneeId?: string;
    page?: number;
    limit?: number;
  },
) {
  const { page, pageSize, skip } = pageWindow(query);
  const where = buildTaskWhere(actor, query);

  const [items, total, defaultProjectId] = await Promise.all([
    prisma.task.findMany({
      where,
      relationLoadStrategy: "join",
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      skip,
      take: pageSize,
      include: taskInclude,
    }),
    prisma.task.count({ where }),
    getUserDefaultProjectId(actor.id),
  ]);

  return pageResult(
    sortByUserDefaultProject(
      items.map((item) => serializeTask(item, defaultProjectId)),
      defaultProjectId,
    ),
    total,
    page,
    pageSize,
  );
}

export async function getTask(actor: Actor, id: string, detailed = true) {
  const task = await prisma.task.findFirst({
    where: { id, AND: [taskAccessWhere(actor)] },
    include: detailed
      ? {
          ...taskInclude,
          notes: { orderBy: { updatedAt: "desc" as const } },
          comments: { include: { user: { select: publicUserSelect } }, orderBy: { createdAt: "asc" as const } },
          files: { include: { user: { select: publicUserSelect } }, orderBy: { createdAt: "desc" as const } },
          activities: { include: { actor: { select: publicUserSelect } }, orderBy: { createdAt: "desc" as const }, take: 40 },
        }
      : taskInclude,
  });
  if (!task) throw errors.notFound("Task");
  const defaultProjectId = await getUserDefaultProjectId(actor.id);
  return serializeTask(task, defaultProjectId);
}

export async function createTask(
  actor: Actor,
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
    assigneeIds?: string[];
    blockedReason?: string | null;
  },
) {
  assertWrite(actor);
  await assertCategoryForProject(actor.id, data.categoryId, data.projectId ?? null);
  const sortOrder = await nextSortOrder(actor.id, data.parentTaskId ?? null);
  const blocked = data.status === "BLOCKED";
  const task = await prisma.task.create({
    data: {
      userId: actor.id,
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
      blockedReason: blocked ? data.blockedReason ?? null : null,
      blockedById: blocked ? actor.id : null,
      blockedAt: blocked ? new Date() : null,
    },
  });
  const assigneeIds = await syncAssignees(task.id, actor.id, data.assigneeIds);
  if (data.tags?.length) await syncTags(actor.id, task.id, data.tags);
  if (data.subtasks?.length) await syncChecklist(actor.id, task.id, data.subtasks);
  if (data.parentTaskId) await applyParentProgress(actor.id, data.parentTaskId);
  const name = actorName(actor);
  invalidateReadCache("analytics:");
  void recordActivity({
    type: "TASK_CREATED",
    actorId: actor.id,
    taskId: task.id,
    projectId: task.projectId,
    message: `${name} created ${task.title}`,
  });
  void notifyUsers({
    userIds: assigneeIds,
    type: "TASK_CREATED",
    title: "New task assigned",
    body: `${name} assigned you a task: ${task.title}.`,
    actorId: actor.id,
    taskId: task.id,
    projectId: task.projectId,
    priority: "High",
    eventId: `created:${task.id}`,
  });
  void import("./notificationEngine.js").then((engine) =>
    engine.syncTaskReminders(
      {
        id: task.id,
        title: task.title,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        status: task.status,
        userId: task.userId,
        projectId: task.projectId,
      },
      assigneeIds,
    ),
  );
  return getTask(actor, task.id, false);
}

export async function updateTask(
  actor: Actor,
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
    assigneeIds?: string[];
    blockedReason?: string | null;
  },
) {
  assertWrite(actor);
  invalidateReadCache("analytics:");
  const existing = await getAccessibleTask(actor, id);

  const nextProjectId = data.projectId !== undefined ? data.projectId : existing.projectId;
  let nextCategoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
  if (data.projectId !== undefined && data.projectId !== existing.projectId && data.categoryId === undefined) {
    nextCategoryId = null;
  }
  await assertCategoryForProject(existing.userId, nextCategoryId, nextProjectId);

  const nextStatus = data.status ?? existing.status;
  const completedAt =
    nextStatus === "DONE" && existing.status !== "DONE"
      ? new Date()
      : nextStatus !== "DONE"
        ? null
        : existing.completedAt;

  const blocked = nextStatus === "BLOCKED";
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
      blockedReason: blocked ? (data.blockedReason !== undefined ? data.blockedReason : existing.blockedReason) : null,
      blockedById: blocked ? existing.blockedById ?? actor.id : null,
      blockedAt: blocked ? existing.blockedAt ?? new Date() : null,
    },
  });

  if (data.projectId !== undefined || data.categoryId !== undefined) {
    await prisma.task.updateMany({
      where: { parentTaskId: id },
      data: { projectId: nextProjectId, categoryId: nextCategoryId },
    });
  }

  if (data.tags) await syncTags(existing.userId, id, data.tags);
  if (data.subtasks) await syncChecklist(existing.userId, id, data.subtasks);
  if (data.assigneeIds) {
    const previousRows = await prisma.taskAssignee.findMany({ where: { taskId: id }, select: { userId: true } });
    const previous = previousRows.map((row) => row.userId);
    const ids = await syncAssignees(id, existing.userId, data.assigneeIds);
    const name = actorName(actor);
    const added = ids.filter((userId) => !previous.includes(userId));
    const removed = previous.filter((userId) => !ids.includes(userId));
    void recordActivity({
      type: "TASK_ASSIGNED",
      actorId: actor.id,
      taskId: id,
      projectId: existing.projectId,
      message: `${name} updated assignees on ${existing.title}`,
    });
    void notifyUsers({
      userIds: added,
      type: previous.length ? "TASK_REASSIGNED" : "TASK_ASSIGNED",
      title: previous.length ? "Task reassigned" : "New task assigned",
      body: `${name} assigned you: ${existing.title}.`,
      actorId: actor.id,
      taskId: id,
      projectId: existing.projectId,
      priority: "High",
      eventId: `assign:${id}:${added.join(",")}`,
    });
    void notifyUsers({
      userIds: removed,
      type: "TASK_UNASSIGNED",
      title: "Removed from a task",
      body: `${name} removed you from ${existing.title}.`,
      actorId: actor.id,
      taskId: id,
      projectId: existing.projectId,
      eventId: `unassign:${id}:${removed.join(",")}`,
    });
  }
  if (data.status && !existing.parentTaskId && !data.subtasks) {
    await cascadeParentStatus(existing.userId, id, nextStatus, existing.status);
  }
  if (existing.parentTaskId && (data.status || data.title)) {
    await applyParentProgress(existing.userId, existing.parentTaskId);
  }
  if (nextStatus === "DONE") {
    void prisma.user.updateMany({
      where: { id: existing.userId, currentFocusTaskId: id },
      data: { currentFocusTaskId: null },
    });
  }

  const name = actorName(actor);
  const watchers = async () => {
    const rows = await prisma.taskAssignee.findMany({ where: { taskId: id }, select: { userId: true } });
    return [existing.userId, ...rows.map((row) => row.userId)];
  };
  if (data.status && data.status !== existing.status) {
    void recordActivity({
      type: data.status === "DONE" ? "TASK_COMPLETED" : data.status === "BLOCKED" ? "TASK_BLOCKED" : "STATUS_CHANGED",
      actorId: actor.id,
      taskId: id,
      projectId: existing.projectId,
      message: `${name} changed ${existing.title} to ${data.status}`,
      metadata: { from: existing.status, to: data.status, blockedReason: data.blockedReason ?? null },
    });
    if (data.status === "DONE") {
      void (async () => {
        const assignees = await prisma.taskAssignee.findMany({ where: { taskId: id }, select: { userId: true } });
        const assigneeIds = assignees.map((row) => row.userId);
        await onTaskCompleted({
          actorId: actor.id,
          taskOwnerId: existing.userId,
          priority: data.priority ?? existing.priority,
          assigneeIds,
        });
        await notifyUsers({
          userIds: [existing.userId, ...assigneeIds],
          type: existing.userId === actor.id ? "TASK_COMPLETED" : "TEAM_TASK_COMPLETED",
          title: "Task completed",
          body: `${name} completed ${existing.title}.`,
          actorId: actor.id,
          taskId: id,
          projectId: existing.projectId,
          eventId: `done:${id}`,
        });
      })();
      void import("./notificationEngine.js").then((engine) => engine.cancelTaskReminders(id));
    } else if (existing.status === "DONE") {
      void notifyUsers({
        userIds: await watchers(),
        type: "TASK_REOPENED",
        title: "Task reopened",
        body: `${name} reopened ${existing.title}.`,
        actorId: actor.id,
        taskId: id,
        projectId: existing.projectId,
        eventId: `reopen:${id}:${data.status}`,
      });
    } else if (data.status === "BLOCKED") {
      void notifyUsers({
        userIds: await watchers(),
        type: "TASK_BLOCKED",
        title: "Task blocked",
        body: `${name} blocked ${existing.title}.`,
        actorId: actor.id,
        taskId: id,
        projectId: existing.projectId,
        priority: "High",
        eventId: `blocked:${id}`,
      });
    } else if (existing.status === "BLOCKED") {
      void notifyUsers({
        userIds: await watchers(),
        type: "TASK_UNBLOCKED",
        title: "Task unblocked",
        body: `${existing.title} is available again.`,
        actorId: actor.id,
        taskId: id,
        projectId: existing.projectId,
        eventId: `unblocked:${id}:${data.status}`,
      });
    } else {
      void notifyUsers({
        userIds: await watchers(),
        type: "TASK_STATUS_CHANGED",
        title: "Task status changed",
        body: `${existing.title} is now ${data.status}.`,
        actorId: actor.id,
        taskId: id,
        projectId: existing.projectId,
        eventId: `status:${id}:${data.status}`,
      });
    }
  }
  if (data.priority && data.priority !== existing.priority) {
    void recordActivity({
      type: "PRIORITY_CHANGED",
      actorId: actor.id,
      taskId: id,
      projectId: existing.projectId,
      message: `${name} changed priority on ${existing.title}`,
    });
    void notifyUsers({
      userIds: await watchers(),
      type: "TASK_PRIORITY_CHANGED",
      title: "Priority changed",
      body: `${existing.title} is now ${data.priority}.`,
      actorId: actor.id,
      taskId: id,
      projectId: existing.projectId,
      eventId: `priority:${id}:${data.priority}`,
    });
  }
  if (data.dueDate !== undefined && data.dueDate !== existing.dueDate) {
    void recordActivity({
      type: "DUE_DATE_CHANGED",
      actorId: actor.id,
      taskId: id,
      projectId: existing.projectId,
      message: `${name} changed the due date on ${existing.title}`,
    });
    void notifyUsers({
      userIds: await watchers(),
      type: "TASK_DUE_DATE_CHANGED",
      title: "Deadline changed",
      body: `${existing.title} is now due ${data.dueDate ?? "with no date"}.`,
      actorId: actor.id,
      taskId: id,
      projectId: existing.projectId,
      eventId: `due:${id}:${data.dueDate ?? "none"}`,
    });
  }
  if (data.dueDate !== undefined || data.dueTime !== undefined || data.status) {
    void import("./notificationEngine.js").then(async (engine) => {
      const assignees = await prisma.taskAssignee.findMany({ where: { taskId: id }, select: { userId: true } });
      await engine.syncTaskReminders(
        {
          id,
          title: data.title ?? existing.title,
          dueDate: data.dueDate !== undefined ? data.dueDate : existing.dueDate,
          dueTime: data.dueTime !== undefined ? data.dueTime : existing.dueTime,
          status: nextStatus,
          userId: existing.userId,
          projectId: nextProjectId,
        },
        assignees.map((row) => row.userId),
      );
    });
  }

  return getTask(actor, id, false);
}

export async function updateTaskStatus(actor: Actor, id: string, status: TaskStatus, blockedReason?: string | null) {
  return updateTask(actor, id, { status, blockedReason });
}

export async function deleteTask(actor: Actor, id: string) {
  assertWrite(actor);
  invalidateReadCache("analytics:");
  const existing = await getAccessibleTask(actor, id);
  if (existing.userId !== actor.id && actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") {
    throw errors.forbidden();
  }
  const parentId = existing.parentTaskId;
  const assignees = await prisma.taskAssignee.findMany({ where: { taskId: id }, select: { userId: true } });
  void notifyUsers({
    userIds: [existing.userId, ...assignees.map((row) => row.userId)],
    type: "TASK_DELETED",
    title: "Task deleted",
    body: `${actorName(actor)} deleted ${existing.title}.`,
    actorId: actor.id,
    taskId: id,
    projectId: existing.projectId,
    eventId: `deleted:${id}`,
  });
  void import("./notificationEngine.js").then((engine) => engine.cancelTaskReminders(id));
  await prisma.task.delete({ where: { id } });
  if (parentId) await applyParentProgress(existing.userId, parentId);
  return { ok: true };
}

export async function duplicateTask(actor: Actor, id: string) {
  const task = await getTask(actor, id);
  return createTask(actor, {
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
    assigneeIds: (task.assignees ?? [])
      .map((row) => (row as { userId?: string; id?: string }).userId ?? (row as { id?: string }).id)
      .filter((id): id is string => Boolean(id)),
  });
}

export async function postponeTask(actor: Actor, id: string, date?: string) {
  const existing = await getAccessibleTask(actor, id);
  const next = date ?? addDaysIso(existing.dueDate ?? todayIso(), 1);
  return updateTask(actor, id, {
    dueDate: next,
    status: existing.status === "INBOX" ? "TODO" : existing.status,
  });
}

export async function captureInbox(actor: Actor, title: string) {
  return createTask(actor, { title, status: "INBOX", priority: "MEDIUM" });
}

export async function reorderTasks(actor: Actor, ids: string[]) {
  assertWrite(actor);
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) throw errors.badRequest("Task ids must be unique.");
  const existing = await prisma.task.findMany({
    where: { id: { in: ids }, AND: [taskAccessWhere(actor)] },
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

export async function logTime(actor: Actor, id: string, minutes: number) {
  assertWrite(actor);
  const existing = await getAccessibleTask(actor, id);
  return updateTask(actor, id, { actualMinutes: (existing.actualMinutes ?? 0) + minutes });
}
