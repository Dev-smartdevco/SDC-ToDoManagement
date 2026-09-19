import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "./prisma.js";
import { errors } from "./httpError.js";

export type Actor = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
};

const actorCache = new Map<string, { actor: Actor; exp: number }>();
const ACTOR_TTL_MS = 30_000;

export function invalidateActor(userId?: string) {
  if (userId) actorCache.delete(userId);
  else actorCache.clear();
}

export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
} as const;

export function isAdmin(actor: Pick<Actor, "role">) {
  return actor.role === "SUPER_ADMIN" || actor.role === "ADMIN";
}

export function isViewer(actor: Pick<Actor, "role">) {
  return actor.role === "VIEWER";
}

export function assertAdmin(actor: Actor) {
  if (!isAdmin(actor)) throw errors.forbidden();
}

export function assertWrite(actor: Actor) {
  if (isViewer(actor)) throw errors.forbidden();
}

export function projectAccessWhere(actor: Actor): Prisma.ProjectWhereInput {
  if (isAdmin(actor)) return {};
  return {
    OR: [{ userId: actor.id }, { members: { some: { userId: actor.id } } }],
  };
}

export function taskAccessWhere(actor: Actor): Prisma.TaskWhereInput {
  if (isAdmin(actor)) return {};
  return {
    OR: [
      { userId: actor.id },
      { assignees: { some: { userId: actor.id } } },
      { project: { OR: [{ userId: actor.id }, { members: { some: { userId: actor.id } } }] } },
    ],
  };
}

export function myTaskWhere(actor: Actor): Prisma.TaskWhereInput {
  return {
    OR: [{ userId: actor.id }, { assignees: { some: { userId: actor.id } } }],
  };
}

export function noteAccessWhere(actor: Actor): Prisma.NoteWhereInput {
  if (isAdmin(actor)) return {};
  return {
    OR: [
      { userId: actor.id },
      { project: { OR: [{ userId: actor.id }, { members: { some: { userId: actor.id } } }] } },
    ],
  };
}

export async function getAccessibleProject(actor: Actor, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, AND: [projectAccessWhere(actor)] },
  });
  if (!project) throw errors.notFound("Project");
  return project;
}

export async function getAccessibleTask(actor: Actor, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, AND: [taskAccessWhere(actor)] },
  });
  if (!task) throw errors.notFound("Task");
  return task;
}

export function canManageProject(actor: Actor, project: { userId: string }) {
  if (isViewer(actor)) return false;
  return isAdmin(actor) || project.userId === actor.id;
}

export function assertCanManageProject(actor: Actor, project: { userId: string }) {
  if (!canManageProject(actor, project)) throw errors.forbidden();
}

export async function loadActor(userId: string): Promise<Actor> {
  const hit = actorCache.get(userId);
  if (hit && hit.exp > Date.now()) return hit.actor;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, isActive: true, mustChangePassword: true },
  });
  if (!user || !user.isActive) {
    actorCache.delete(userId);
    throw errors.unauthorized();
  }
  actorCache.set(userId, { actor: user, exp: Date.now() + ACTOR_TTL_MS });
  return user;
}
