import type { AchievementCondition, Priority, RewardRuleType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { weekDates } from "../lib/dates.js";
import { levelFromXp } from "../lib/xp.js";

let rulesCache: Map<RewardRuleType, number> | null = null;
let rulesCachedAt = 0;

async function rulePoints(type: RewardRuleType) {
  if (!rulesCache || Date.now() - rulesCachedAt > 60_000) {
    const rows = await prisma.rewardRule.findMany({ where: { active: true } });
    rulesCache = new Map(rows.map((row) => [row.type, row.points]));
    rulesCachedAt = Date.now();
  }
  return rulesCache.get(type) ?? 0;
}

async function addXp(userId: string, points: number) {
  if (points <= 0) return;
  const before = await prisma.user.findUnique({ where: { id: userId }, select: { xp: true } });
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { xp: { increment: points } },
    select: { xp: true },
  });
  const { notifyUsers } = await import("../lib/events.js");
  const previous = levelFromXp(before?.xp ?? 0).level;
  const next = levelFromXp(updated.xp);
  void notifyUsers({
    userIds: [userId],
    type: "REWARD_RECEIVED",
    title: "XP received",
    body: `You earned ${points} XP.`,
    eventId: `xp:${userId}:${updated.xp}`,
  });
  if (next.level > previous) {
    void notifyUsers({
      userIds: [userId],
      type: "LEVEL_UP",
      title: "Level up",
      body: `You reached level ${next.level}.`,
      priority: "High",
      eventId: `level:${userId}:${next.level}`,
    });
  }
}

async function awardIfMissing(userId: string, achievementId: string) {
  const row = await prisma.userAchievement.upsert({
    where: { userId_achievementId: { userId, achievementId } },
    update: {},
    create: { userId, achievementId },
  });
  return row.earnedAt.getTime() > Date.now() - 2000;
}

async function completedTaskCount(userId: string) {
  return prisma.task.count({
    where: { OR: [{ userId }, { assignees: { some: { userId } } }], status: "DONE", parentTaskId: null },
  });
}

async function helpedCount(userId: string) {
  return prisma.task.count({
    where: {
      status: "DONE",
      parentTaskId: null,
      userId: { not: userId },
      assignees: { some: { userId } },
    },
  });
}

async function completedProjects(userId: string) {
  return prisma.project.count({
    where: {
      status: "COMPLETED",
      OR: [{ userId }, { members: { some: { userId } } }],
    },
  });
}

async function activityStreak(userId: string) {
  const rows = await prisma.task.findMany({
    where: {
      status: "DONE",
      parentTaskId: null,
      completedAt: { not: null },
      OR: [{ userId }, { assignees: { some: { userId } } }],
    },
    select: { completedAt: true },
    orderBy: { completedAt: "desc" },
    take: 400,
  });
  const days = new Set(
    rows
      .map((row) => row.completedAt?.toISOString().slice(0, 10))
      .filter((value): value is string => Boolean(value)),
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i += 1) {
    const cursor = new Date(today);
    cursor.setDate(today.getDate() - i);
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) streak += 1;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}

export async function evaluateAchievements(userId: string) {
  const [achievements, done, helped, projects, streak] = await Promise.all([
    prisma.achievement.findMany({ where: { active: true } }),
    completedTaskCount(userId),
    helpedCount(userId),
    completedProjects(userId),
    activityStreak(userId),
  ]);

  const needsTop = achievements.some((item) => item.condition === "TOP_CONTRIBUTOR");
  let topUserId = "";
  if (needsTop) {
    const week = weekDates(new Date().toISOString().slice(0, 10));
    const weekStart = new Date(`${week[0]}T00:00:00.000Z`);
    const weekEnd = new Date(`${week[6]}T23:59:59.999Z`);
    const weekCounts = await prisma.task.groupBy({
      by: ["userId"],
      where: { status: "DONE", parentTaskId: null, completedAt: { gte: weekStart, lte: weekEnd } },
      _count: { _all: true },
    });
    const top = weekCounts.reduce(
      (best, row) => (row._count._all > best.count ? { userId: row.userId, count: row._count._all } : best),
      { userId: "", count: 0 },
    );
    topUserId = top.count > 0 ? top.userId : "";
  }

  const valueFor = (condition: AchievementCondition) => {
    if (condition === "TASKS_COMPLETED") return done;
    if (condition === "PROJECT_COMPLETED") return projects;
    if (condition === "TEAM_PLAYER") return helped;
    if (condition === "STREAK") return streak;
    if (condition === "TOP_CONTRIBUTOR") return topUserId === userId ? 1 : 0;
    return 0;
  };

  const unlocked = [];
  for (const achievement of achievements) {
    if (valueFor(achievement.condition) >= achievement.threshold) {
      const created = await awardIfMissing(userId, achievement.id);
      if (created) {
        unlocked.push(achievement);
        const { notifyUsers } = await import("../lib/events.js");
        void notifyUsers({
          userIds: [userId],
          type: achievement.condition === "STREAK" ? "STREAK" : "ACHIEVEMENT_UNLOCKED",
          title: achievement.condition === "STREAK" ? "Productivity streak" : "Achievement unlocked",
          body: achievement.name,
          eventId: `achievement:${userId}:${achievement.id}`,
        });
      }
    }
  }
  return unlocked;
}

export async function onTaskCompleted(input: {
  actorId: string;
  taskOwnerId: string;
  priority: Priority;
  assigneeIds: string[];
}) {
  const helper = input.actorId !== input.taskOwnerId;
  const high = input.priority === "HIGH" || input.priority === "URGENT";
  const [completePoints, helpPoints] = await Promise.all([
    rulePoints(high ? "HIGH_PRIORITY_COMPLETED" : "TASK_COMPLETED"),
    helper ? rulePoints("HELPING_TEAMMATE") : Promise.resolve(0),
  ]);
  await addXp(input.actorId, completePoints + helpPoints);

  const targets = [...new Set([input.actorId, input.taskOwnerId, ...input.assigneeIds])];
  void (async () => {
    const streak = await activityStreak(input.actorId);
    if (streak >= 7) {
      const bonus = await rulePoints("STREAK_7");
      const already = await prisma.userAchievement.findFirst({
        where: { userId: input.actorId, achievement: { key: "streak_7" } },
      });
      if (!already) await addXp(input.actorId, bonus);
    }
    await Promise.all(targets.map((userId) => evaluateAchievements(userId)));
  })();
}

export async function onProjectCompleted(userId: string) {
  const points = await rulePoints("PROJECT_COMPLETED");
  await addXp(userId, points);
  await evaluateAchievements(userId);
}

export async function listAchievements(userId: string) {
  const [catalog, awards, user] = await Promise.all([
    prisma.achievement.findMany({ where: { active: true }, orderBy: { threshold: "asc" } }),
    prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { earnedAt: "desc" },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { xp: true, name: true } }),
  ]);
  const earnedIds = new Set(awards.map((row) => row.achievementId));
  return {
    profile: { name: user?.name, ...levelFromXp(user?.xp ?? 0) },
    catalog: catalog.map((item) => ({ ...item, earned: earnedIds.has(item.id) })),
    earned: awards.map((row) => ({ ...row.achievement, earnedAt: row.earnedAt })),
  };
}

export async function listRewardRules() {
  return prisma.rewardRule.findMany({ orderBy: { type: "asc" } });
}

export async function updateRewardRule(id: string, data: { points?: number; active?: boolean }) {
  return prisma.rewardRule.update({
    where: { id },
    data: {
      points: data.points,
      active: data.active,
    },
  });
}
