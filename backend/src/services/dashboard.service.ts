import { prisma } from "../lib/prisma.js";
import { daysBetween, safePercent, todayIso, weekDates } from "../lib/dates.js";
import { serializeTaggedTask } from "../lib/taskProgress.js";
import { sortByUserDefaultProject, withNestedProjectDefaultFlag } from "../lib/defaultProject.js";
import { categoryStats } from "./categories.service.js";

const OPEN_STATUSES = ["INBOX", "TODO", "IN_PROGRESS", "BLOCKED"] as const;

const taskPreview = {
  project: { select: { id: true, name: true, color: true, icon: true } },
  category: { select: { id: true, name: true, color: true, icon: true, projectId: true } },
  tags: { include: { tag: true } },
  subtasks: { select: { id: true, title: true, status: true }, orderBy: { sortOrder: "asc" } },
} as const;

function mapTask<T extends { tags: { tag: { id: string; name: string } }[]; project?: { id: string } | null }>(
  task: T,
  defaultProjectId: string | null,
) {
  return withNestedProjectDefaultFlag(serializeTaggedTask(task), defaultProjectId);
}

export async function getTodayDashboard(userId: string, date = todayIso()) {
  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

  const [todayTasks, overdueTasks, laterTasks, timeBlocks, activeFocus, user, focusAgg, existingReview] =
    await Promise.all([
      prisma.task.findMany({
        where: {
          OR: [{ userId }, { assignees: { some: { userId } } }],
          parentTaskId: null,
          dueDate: date,
          status: { not: "CANCELLED" },
        },
        orderBy: [{ sortOrder: "asc" }, { dueTime: "asc" }, { createdAt: "desc" }],
        include: taskPreview,
      }),
      prisma.task.findMany({
        where: {
          OR: [{ userId }, { assignees: { some: { userId } } }],
          parentTaskId: null,
          status: { in: [...OPEN_STATUSES] },
          dueDate: { lt: date, not: null },
        },
        orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        take: 40,
        include: taskPreview,
      }),
      prisma.task.findMany({
        where: {
          OR: [{ userId }, { assignees: { some: { userId } } }],
          parentTaskId: null,
          status: { in: [...OPEN_STATUSES] },
          dueDate: { gt: date },
        },
        orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        take: 12,
        include: taskPreview,
      }),
      prisma.timeBlock.findMany({
        where: { userId, date },
        orderBy: { startTime: "asc" },
        include: {
          project: { select: { id: true, name: true, color: true } },
          task: { select: { id: true, title: true } },
        },
      }),
      prisma.focusSession.findFirst({
        where: { userId, status: { in: ["RUNNING", "PAUSED"] } },
        include: { task: { include: { project: { select: { id: true, name: true, color: true } } } } },
        orderBy: { startedAt: "desc" },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { currentFocusTaskId: true, defaultProjectId: true } }),
      prisma.focusSession.aggregate({
        where: {
          userId,
          status: "COMPLETED",
          startedAt: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { durationMinutes: true },
      }),
      prisma.dailyReview.findUnique({
        where: { userId_date: { userId, date } },
        select: { plannedTasks: true, completedTasks: true, focusMinutes: true },
      }),
    ]);

  const defaultProjectId = user?.defaultProjectId ?? null;
  const planned = todayTasks.filter((t) => t.status !== "CANCELLED");
  const completed = planned.filter((t) => t.status === "DONE");
  const plannedCount = planned.length;
  const completedCount = completed.length;
  const progress = safePercent(completedCount, plannedCount);
  const focusMinutes = focusAgg._sum.durationMinutes ?? 0;

  const focusTaskId = user?.currentFocusTaskId;
  const currentFocus =
    todayTasks.find((t) => t.id === focusTaskId && t.status !== "DONE") ??
    overdueTasks.find((t) => t.id === focusTaskId && t.status !== "DONE") ??
    todayTasks.find((t) => t.status === "IN_PROGRESS") ??
    todayTasks.find((t) => t.status !== "DONE" && (t.priority === "URGENT" || t.priority === "HIGH")) ??
    todayTasks.find((t) => t.status !== "DONE") ??
    overdueTasks[0] ??
    null;

  if (
    !existingReview ||
    existingReview.plannedTasks !== plannedCount ||
    existingReview.completedTasks !== completedCount ||
    existingReview.focusMinutes !== focusMinutes
  ) {
    await prisma.dailyReview.upsert({
      where: { userId_date: { userId, date } },
      update: {
        plannedTasks: plannedCount,
        completedTasks: completedCount,
        focusMinutes,
      },
      create: {
        userId,
        date,
        plannedTasks: plannedCount,
        completedTasks: completedCount,
        focusMinutes,
      },
    });
  }

  const plannedMapped = planned.map((task) => mapTask(task, defaultProjectId));
  const defaultPlanned = sortByUserDefaultProject(
    plannedMapped.filter((task) => task.project?.isDefault),
    defaultProjectId,
  );
  const otherPlanned = plannedMapped.filter((task) => !task.project?.isDefault);

  return {
    date,
    progress,
    plannedCount,
    completedCount,
    focusMinutes,
    overdueCount: overdueTasks.length,
    currentFocus: currentFocus ? mapTask(currentFocus, defaultProjectId) : null,
    activeFocus,
    todayTasks: {
      default: defaultPlanned,
      high: otherPlanned.filter((t) => t.priority === "HIGH" || t.priority === "URGENT"),
      normal: otherPlanned.filter((t) => t.priority === "MEDIUM"),
      low: otherPlanned.filter((t) => t.priority === "LOW"),
    },
    overdue: sortByUserDefaultProject(
      overdueTasks.map((task) => ({
        ...mapTask(task, defaultProjectId),
        daysOverdue: Math.max(1, daysBetween(task.dueDate as string, date)),
      })),
      defaultProjectId,
    ),
    later: sortByUserDefaultProject(
      laterTasks.map((task) => mapTask(task, defaultProjectId)),
      defaultProjectId,
    ),
    timeBlocks,
  };
}

export async function getWeekReview(userId: string, date = todayIso()) {
  const days = weekDates(date);
  const start = days[0];
  const end = days[6];
  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

  const [reviews, completedTasks, focusSessions, plannedCount, completedCount, overdueCount, focusAgg] = await Promise.all([
    prisma.dailyReview.findMany({
      where: { userId, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: "DONE",
        completedAt: {
          gte: new Date(`${start}T00:00:00.000Z`),
          lte: new Date(`${end}T23:59:59.999Z`),
        },
      },
      select: { project: { select: { id: true, name: true, color: true } } },
    }),
    prisma.focusSession.findMany({
      where: {
        userId,
        status: "COMPLETED",
        startedAt: {
          gte: new Date(`${start}T00:00:00.000Z`),
          lte: new Date(`${end}T23:59:59.999Z`),
        },
      },
      select: { startedAt: true, durationMinutes: true },
    }),
    prisma.task.count({
      where: { userId, parentTaskId: null, dueDate: date, status: { not: "CANCELLED" } },
    }),
    prisma.task.count({
      where: { userId, parentTaskId: null, dueDate: date, status: "DONE" },
    }),
    prisma.task.count({
      where: {
        userId,
        parentTaskId: null,
        status: { in: [...OPEN_STATUSES] },
        dueDate: { lt: date, not: null },
      },
    }),
    prisma.focusSession.aggregate({
      where: {
        userId,
        status: "COMPLETED",
        startedAt: { gte: startOfDay, lte: endOfDay },
      },
      _sum: { durationMinutes: true },
    }),
  ]);

  const byDay = days.map((day) => {
    const review = reviews.find((r) => r.date === day);
    const dayFocus = focusSessions
      .filter((s) => s.startedAt.toISOString().slice(0, 10) === day)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    return {
      date: day,
      planned: review?.plannedTasks ?? 0,
      completed: review?.completedTasks ?? 0,
      focusMinutes: review?.focusMinutes ?? dayFocus,
    };
  });

  const projectMap = new Map<string, { id: string; name: string; color: string; completed: number }>();
  for (const task of completedTasks) {
    if (!task.project) continue;
    const current = projectMap.get(task.project.id) ?? {
      id: task.project.id,
      name: task.project.name,
      color: task.project.color,
      completed: 0,
    };
    current.completed += 1;
    projectMap.set(task.project.id, current);
  }

  return {
    today: {
      completed: completedCount,
      planned: plannedCount,
      completion: safePercent(completedCount, plannedCount),
      focusMinutes: focusAgg._sum.durationMinutes ?? 0,
      overdue: overdueCount,
    },
    week: byDay,
    topProjects: [...projectMap.values()].sort((a, b) => b.completed - a.completed).slice(0, 5),
  };
}

export async function updateReviewNotes(userId: string, date: string, notes: string | null) {
  return prisma.dailyReview.upsert({
    where: { userId_date: { userId, date } },
    update: { notes },
    create: { userId, date, notes, plannedTasks: 0, completedTasks: 0, focusMinutes: 0 },
  });
}

export async function getTaskStats(userId: string, query: { projectId?: string; categoryId?: string }) {
  const today = todayIso();
  const where = {
    userId,
    parentTaskId: null,
    projectId: query.projectId || undefined,
    categoryId: query.categoryId || undefined,
  };

  const [grouped, overdue] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.task.count({
      where: { ...where, status: { in: [...OPEN_STATUSES] }, dueDate: { lt: today, not: null } },
    }),
  ]);

  const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
  const completed = grouped.filter((row) => row.status === "DONE").reduce((sum, row) => sum + row._count._all, 0);
  const open = grouped
    .filter((row) => row.status === "INBOX" || row.status === "TODO" || row.status === "IN_PROGRESS" || row.status === "BLOCKED")
    .reduce((sum, row) => sum + row._count._all, 0);

  const categories = query.projectId && !query.categoryId ? await categoryStats(userId, query.projectId) : [];

  return {
    totalTasks: total,
    completedTasks: completed,
    openTasks: open,
    overdueTasks: overdue,
    categories,
  };
}
