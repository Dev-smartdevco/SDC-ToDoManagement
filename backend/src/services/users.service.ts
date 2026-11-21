import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import { assertAdmin, invalidateActor, isAdmin, type Actor } from "../lib/access.js";
import { recordActivity } from "../lib/events.js";
import { levelFromXp } from "../lib/xp.js";

const listSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  lastLoginAt: true,
  xp: true,
} as const;

function tempPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

export async function listUsers(
  actor: Actor,
  query: { q?: string; role?: UserRole; active?: boolean },
) {
  assertAdmin(actor);
  const users = await prisma.user.findMany({
    where: {
      role: query.role,
      isActive: query.active,
      OR: query.q
        ? [
            { name: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
          ]
        : undefined,
    },
    select: listSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
  });

  if (!users.length) return [];

  const userIds = users.map((u) => u.id);
  if (!userIds.length) return [];

  const [ownerGroups, projectCounts] = await Promise.all([
    prisma.task.groupBy({
      by: ["userId", "status"],
      where: { parentTaskId: null, userId: { in: userIds } },
      _count: { _all: true },
    }),
    prisma.projectMember.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _count: { _all: true },
    }),
  ]);

  return users.map((user) => {
    const related = ownerGroups.filter((row) => row.userId === user.id);
    const activeTasks = related
      .filter((row) => !["DONE", "CANCELLED"].includes(row.status))
      .reduce((sum, row) => sum + row._count._all, 0);
    const completedTasks = related
      .filter((row) => row.status === "DONE")
      .reduce((sum, row) => sum + row._count._all, 0);
    const projectsCount = projectCounts.find((row) => row.userId === user.id)?._count._all ?? 0;
    return {
      ...user,
      ...levelFromXp(user.xp),
      activeTasks,
      completedTasks,
      projectsCount,
    };
  });
}

export async function directory(actor: Actor) {
  if (isAdmin(actor)) {
    return prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
      take: 100,
    });
  }
  const memberships = await prisma.projectMember.findMany({
    where: { userId: actor.id },
    select: { projectId: true },
  });
  const owned = await prisma.project.findMany({
    where: { userId: actor.id },
    select: { id: true },
  });
  const projectIds = [...new Set([...memberships.map((m) => m.projectId), ...owned.map((p) => p.id)])];
  const members = projectIds.length
    ? await prisma.projectMember.findMany({
        where: { projectId: { in: projectIds } },
        select: { user: { select: { id: true, name: true, email: true, role: true } } },
      })
    : [];
  const self = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { id: true, name: true, email: true, role: true },
  });
  const map = new Map<string, { id: string; name: string; email: string; role: UserRole }>();
  if (self) map.set(self.id, self);
  for (const row of members) map.set(row.user.id, row.user);
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getUser(actor: Actor, id: string) {
  assertAdmin(actor);
  const user = await prisma.user.findUnique({
    where: { id },
    select: { ...listSelect, updatedAt: true },
  });
  if (!user) throw errors.notFound("User");
  const assignedWhere = {
    parentTaskId: null,
    OR: [{ userId: id }, { assignees: { some: { userId: id } } }],
  };
  const [activeTasks, completedTasks, projectsCount, awards] = await Promise.all([
    prisma.task.count({
      where: { ...assignedWhere, status: { notIn: ["DONE", "CANCELLED"] } },
    }),
    prisma.task.count({ where: { ...assignedWhere, status: "DONE" } }),
    prisma.project.count({
      where: { OR: [{ userId: id }, { members: { some: { userId: id } } }] },
    }),
    prisma.userAchievement.findMany({
      where: { userId: id },
      include: { achievement: true },
      orderBy: { earnedAt: "desc" },
    }),
  ]);
  return {
    ...user,
    ...levelFromXp(user.xp),
    activeTasks,
    completedTasks,
    projectsCount,
    achievements: awards.map((row) => ({
      ...row.achievement,
      earnedAt: row.earnedAt,
    })),
  };
}

export async function createUser(
  actor: Actor,
  data: { name: string; email: string; role?: UserRole; password?: string },
) {
  assertAdmin(actor);
  if (data.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") throw errors.forbidden();
  const email = data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw errors.conflict("A user with this email already exists.");
  const password = data.password?.trim() || tempPassword();
  const user = await prisma.user.create({
    data: {
      name: data.name.trim(),
      email,
      role: data.role ?? "MEMBER",
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: !data.password,
    },
    select: listSelect,
  });
  void recordActivity({
    type: "USER_ADDED",
    actorId: actor.id,
    userId: user.id,
    message: `${actor.email} added ${user.name}`,
  });
  return { ...user, ...levelFromXp(user.xp), temporaryPassword: data.password ? undefined : password };
}

export async function updateUser(
  actor: Actor,
  id: string,
  data: { name?: string; email?: string; role?: UserRole },
) {
  assertAdmin(actor);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw errors.notFound("User");
  if (existing.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") throw errors.forbidden();
  if (data.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") throw errors.forbidden();
  if (data.role && data.role !== "SUPER_ADMIN" && existing.role === "SUPER_ADMIN") {
    const supers = await prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
    if (supers <= 1) throw errors.badRequest("The last super admin cannot be demoted.");
  }
  const user = await prisma.user.update({
    where: { id },
    data: {
      name: data.name?.trim(),
      email: data.email?.toLowerCase(),
      role: data.role,
    },
    select: listSelect,
  });
  invalidateActor(id);
  return { ...user, ...levelFromXp(user.xp) };
}

export async function setUserActive(actor: Actor, id: string, isActive: boolean) {
  assertAdmin(actor);
  if (id === actor.id) throw errors.badRequest("You cannot change your own active status.");
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw errors.notFound("User");
  if (existing.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") throw errors.forbidden();
  if (!isActive && existing.role === "SUPER_ADMIN") {
    const supers = await prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
    if (supers <= 1) throw errors.badRequest("The last super admin cannot be deactivated.");
  }
  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
    select: listSelect,
  });
  invalidateActor(id);
  if (!isActive) {
    void recordActivity({
      type: "USER_REMOVED",
      actorId: actor.id,
      userId: id,
      message: `${actor.email} deactivated ${existing.name}`,
    });
  }
  return { ...user, ...levelFromXp(user.xp) };
}

export async function resetPassword(actor: Actor, id: string) {
  assertAdmin(actor);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw errors.notFound("User");
  if (existing.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN" && id !== actor.id) {
    throw errors.forbidden();
  }
  const password = tempPassword();
  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: true,
    },
  });
  invalidateActor(id);
  return { ok: true, temporaryPassword: password };
}
