import { prisma } from "../lib/prisma.js";
import { daysBetween, safePercent, todayIso, weekDates } from "../lib/dates.js";

const OPEN_STATUSES = ["INBOX", "TODO", "IN_PROGRESS"] as const;

export async function getTodayDashboard(userId: string, date = todayIso()) {
  const [todayTasks, overdueTasks, laterTasks, timeBlocks, activeFocus, user, completedToday] = await Promise.all([
    prisma.task.findMany({
      where: { userId, parentTaskId: null, dueDate: date, status: { not: "CANCELLED" } },
      orderBy: [{ priority: "desc" }, { dueTime: "asc" }, { createdAt: "asc" }],
      include: {
        project: { select: { id: true, name: true, color: true, icon: true } },
        tags: { include: { tag: true } },
      },
    }),
    prisma.task.findMany({
      where: {
        userId,
        parentTaskId: null,
        status: { in: [...OPEN_STATUSES] },
        dueDate: { lt: date, not: null },
      },
      orderBy: { dueDate: "asc" },
      include: {
        project: { select: { id: true, name: true, color: true, icon: true } },
        tags: { include: { tag: true } },
      },
    }),
    prisma.task.findMany({
      where: {
        userId,
        parentTaskId: null,
        status: { in: [...OPEN_STATUSES] },
        dueDate: { gt: date },
      },
      orderBy: { dueDate: "asc" },
      take: 12,
      include: {
        project: { select: { id: true, name: true, color: true, icon: true } },
        tags: { include: { tag: true } },
      },
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
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.task.findMany({
      where: {
        userId,
        parentTaskId: null,
        status: "DONE",
        OR: [{ dueDate: date }, { completedAt: { gte: new Date(`${date}T00:00:00.000Z`) } }],
      },
      select: { id: true },
    }),
  ]);

  const planned = todayTasks.filter((t) => t.status !== "CANCELLED");
  const completed = planned.filter((t) => t.status === "DONE");
  const plannedCount = planned.length;
  const completedCount = completed.length;
  const progress = safePercent(completedCount, plannedCount);

  const focusTaskId = user?.currentFocusTaskId;
  const currentFocus =
    todayTasks.find((t) => t.id === focusTaskId && t.status !== "DONE") ??
    overdueTasks.find((t) => t.id === focusTaskId && t.status !== "DONE") ??
    todayTasks.find((t) => t.status === "IN_PROGRESS") ??
    todayTasks.find((t) => t.status !== "DONE" && (t.priority === "URGENT" || t.priority === "HIGH")) ??
    todayTasks.find((t) => t.status !== "DONE") ??
    overdueTasks[0] ??
    null;

  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);
  const focusAgg = await prisma.focusSession.aggregate({
    where: {
      userId,
      status: "COMPLETED",
      startedAt: { gte: startOfDay, lte: endOfDay },
    },
    _sum: { durationMinutes: true },
  });

  await prisma.dailyReview.upsert({
    where: { userId_date: { userId, date } },
    update: {
      plannedTasks: plannedCount,
      completedTasks: completedCount,
      focusMinutes: focusAgg._sum.durationMinutes ?? 0,
    },
    create: {
      userId,
      date,
      plannedTasks: plannedCount,
      completedTasks: completedCount,
      focusMinutes: focusAgg._sum.durationMinutes ?? 0,
    },
  });

  const mapTask = <T extends { tags: { tag: { id: string; name: string } }[] }>(task: T) => {
    const { tags, ...rest } = task;
    return { ...rest, tags: tags.map((t) => t.tag) };
  };

  return {
    date,
    progress,
    plannedCount,
    completedCount,
    focusMinutes: focusAgg._sum.durationMinutes ?? 0,
    overdueCount: overdueTasks.length,
    currentFocus: currentFocus ? mapTask(currentFocus) : null,
    activeFocus,
    todayTasks: {
      high: planned.filter((t) => t.priority === "HIGH" || t.priority === "URGENT").map(mapTask),
      normal: planned.filter((t) => t.priority === "MEDIUM").map(mapTask),
      low: planned.filter((t) => t.priority === "LOW").map(mapTask),
    },
    overdue: overdueTasks.map((task) => ({
      ...mapTask(task),
      daysOverdue: Math.max(1, daysBetween(task.dueDate as string, date)),
    })),
    later: laterTasks.map(mapTask),
    timeBlocks,
    completedTodayIds: completedToday.map((t) => t.id),
  };
}

export async function getWeekReview(userId: string, date = todayIso()) {
  const days = weekDates(date);
  const start = days[0];
  const end = days[6];

  const [reviews, completedTasks, focusSessions, today] = await Promise.all([
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
      include: { project: { select: { id: true, name: true, color: true } } },
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
    }),
    getTodayDashboard(userId, date),
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
      completed: today.completedCount,
      planned: today.plannedCount,
      completion: today.progress,
      focusMinutes: today.focusMinutes,
      overdue: today.overdueCount,
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
