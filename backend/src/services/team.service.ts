import { prisma } from "../lib/prisma.js";
import { isAdmin, projectAccessWhere, publicUserSelect, taskAccessWhere, type Actor } from "../lib/access.js";
import { subtractDaysIso, todayIso, weekDates } from "../lib/dates.js";

const OPEN = ["INBOX", "TODO", "IN_PROGRESS", "BLOCKED"] as const;

export async function teamDashboard(actor: Actor, date = todayIso()) {
  const projectWhere = projectAccessWhere(actor);
  const week = weekDates(date);
  const weekStart = new Date(`${week[0]}T00:00:00.000Z`);
  const weekEnd = new Date(`${week[6]}T23:59:59.999Z`);

  const activityWhere = isAdmin(actor)
    ? {}
    : {
        OR: [{ actorId: actor.id }, { userId: actor.id }, { project: projectWhere }],
      };
  const taskWhere = { parentTaskId: null, AND: [taskAccessWhere(actor)] };

  const [members, projects, taskGroups, dueSoon, recentActivity, recentAwards, weeklyMessage, weekCompleted] = await Promise.all([
    isAdmin(actor)
      ? prisma.user.count({ where: { isActive: true } })
      : prisma.projectMember
          .findMany({
            where: { project: projectWhere },
            select: { userId: true },
            distinct: ["userId"],
          })
          .then((rows) => rows.length),
    prisma.project.count({ where: { status: "ACTIVE", AND: [projectWhere] } }),
    prisma.task.groupBy({
      by: ["status"],
      where: taskWhere,
      _count: { _all: true },
    }),
    prisma.task.findMany({
      where: {
        ...taskWhere,
        status: { in: [...OPEN] },
        dueDate: { gte: date, lte: subtractDaysIso(date, -3) },
      },
      orderBy: { dueDate: "asc" },
      take: 8,
      select: { id: true, title: true, dueDate: true, status: true, priority: true },
    }),
    prisma.activityLog.findMany({
      where: activityWhere,
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { actor: { select: publicUserSelect } },
    }),
    prisma.userAchievement.findMany({
      orderBy: { earnedAt: "desc" },
      take: 8,
      include: {
        user: { select: publicUserSelect },
        achievement: true,
      },
    }),
    prisma.systemSetting.findUnique({ where: { key: "weeklyAdminMessage" } }),
    prisma.task.groupBy({
      by: ["userId"],
      where: { ...taskWhere, status: "DONE", completedAt: { gte: weekStart, lte: weekEnd } },
      _count: { _all: true },
    }),
  ]);

  const countOf = (status: string) => taskGroups.find((row) => row.status === status)?._count._all ?? 0;
  const completed = countOf("DONE");
  const inProgress = countOf("IN_PROGRESS");
  const todo = countOf("TODO") + countOf("INBOX");
  const blocked = countOf("BLOCKED");

  const users = await prisma.user.findMany({
    where: { id: { in: weekCompleted.map((row) => row.userId) } },
    select: publicUserSelect,
  });
  const recognition = weekCompleted
    .map((row) => ({
      user: users.find((u) => u.id === row.userId),
      completed: row._count._all,
    }))
    .filter((row) => row.user)
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 5);

  return {
    members,
    activeProjects: projects,
    completedTasks: completed,
    inProgressTasks: inProgress,
    todoTasks: todo,
    blockedTasks: blocked,
    dueSoon,
    recentActivity,
    recentAchievements: recentAwards,
    weekly: {
      completedTasks: weekCompleted.reduce((sum, row) => sum + row._count._all, 0),
      blockedTasks: blocked,
      recognition,
      adminMessage: weeklyMessage?.value ?? "",
    },
  };
}

export async function listActivity(actor: Actor, query: { projectId?: string; taskId?: string }) {
  const access = isAdmin(actor)
    ? {}
    : {
        OR: [{ actorId: actor.id }, { userId: actor.id }, { project: projectAccessWhere(actor) }],
      };
  return prisma.activityLog.findMany({
    where: {
      projectId: query.projectId,
      taskId: query.taskId,
      AND: [access],
    },
    include: { actor: { select: publicUserSelect } },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
}
