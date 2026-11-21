import { prisma } from "../lib/prisma.js";
import { projectAccessWhere, taskAccessWhere, type Actor } from "../lib/access.js";
import { subtractDaysIso, todayIso } from "../lib/dates.js";
import { readCache, writeCache } from "../lib/readCache.js";

const ANALYTICS_TTL_MS = 20_000;

export async function analytics(actor: Actor, projectId?: string, bypassCache = false) {
  const cacheKey = `analytics:${actor.id}:${projectId ?? ""}`;
  if (!bypassCache) {
    const cached = readCache<Awaited<ReturnType<typeof loadAnalytics>>>(cacheKey, ANALYTICS_TTL_MS);
    if (cached) return cached;
  }
  const value = await loadAnalytics(actor, projectId);
  writeCache(cacheKey, value);
  return value;
}

async function loadAnalytics(actor: Actor, projectId?: string) {
  const today = todayIso();
  const from = subtractDaysIso(today, 30);
  const taskWhere = {
    parentTaskId: null,
    AND: [taskAccessWhere(actor), projectId ? { projectId } : {}],
  };

  const [created, completed, overdue, blocked, recognitionCount, durations] = await Promise.all([
    prisma.task.count({
      where: { ...taskWhere, createdAt: { gte: new Date(`${from}T00:00:00.000Z`) } },
    }),
    prisma.task.count({
      where: { ...taskWhere, status: "DONE", completedAt: { gte: new Date(`${from}T00:00:00.000Z`) } },
    }),
    prisma.task.count({
      where: {
        ...taskWhere,
        status: { in: ["INBOX", "TODO", "IN_PROGRESS", "BLOCKED"] },
        dueDate: { lt: today, not: null },
      },
    }),
    prisma.task.count({ where: { ...taskWhere, status: "BLOCKED" } }),
    prisma.recognition.count({
      where: { createdAt: { gte: new Date(`${from}T00:00:00.000Z`) }, projectId: projectId || undefined },
    }),
    prisma.task.findMany({
      where: {
        ...taskWhere,
        status: "DONE",
        completedAt: { not: null, gte: new Date(`${from}T00:00:00.000Z`) },
      },
      select: { createdAt: true, completedAt: true, estimatedMinutes: true, actualMinutes: true },
      orderBy: { completedAt: "desc" },
      take: 100,
    }),
  ]);

  const completionTimes = durations
    .map((row) => {
      if (!row.completedAt) return null;
      return (row.completedAt.getTime() - row.createdAt.getTime()) / 86_400_000;
    })
    .filter((value): value is number => value != null && value >= 0);
  const avgCompletionDays = completionTimes.length
    ? Math.round((completionTimes.reduce((sum, value) => sum + value, 0) / completionTimes.length) * 10) / 10
    : 0;
  const estimated = durations.reduce((sum, row) => sum + (row.estimatedMinutes ?? 0), 0);
  const actual = durations.reduce((sum, row) => sum + (row.actualMinutes ?? 0), 0);

  const projects = await prisma.project.findMany({
    where: projectAccessWhere(actor),
    select: { id: true, name: true, color: true, status: true },
  });
  const progressRows = await prisma.task.groupBy({
    by: ["projectId", "status"],
    where: { parentTaskId: null, projectId: { not: null } },
    _count: { _all: true },
  });
  const projectProgress = projects.map((project) => {
    const related = progressRows.filter((row) => row.projectId === project.id);
    const total = related.reduce((sum, row) => sum + row._count._all, 0);
    const done = related.filter((row) => row.status === "DONE").reduce((sum, row) => sum + row._count._all, 0);
    return {
      ...project,
      total,
      completed: done,
      progress: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  });

  return {
    tasksCreated: created,
    tasksCompleted: completed,
    overdueTasks: overdue,
    blockedTasks: blocked,
    recognitionCount,
    averageCompletionDays: avgCompletionDays,
    estimatedMinutes: estimated,
    actualMinutes: actual,
    completionRate: created === 0 ? 0 : Math.round((completed / Math.max(created, 1)) * 100),
    projectProgress,
  };
}

export async function getSettings(actor: Actor) {
  const rows = await prisma.systemSetting.findMany();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function setSetting(key: string, value: string) {
  return prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
