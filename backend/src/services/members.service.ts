import type { ProjectMemberRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import {
  assertCanManageProject,
  assertWrite,
  getAccessibleProject,
  publicUserSelect,
  type Actor,
} from "../lib/access.js";
import { actorName, notifyUsers, recordActivity } from "../lib/events.js";

export async function listMembers(actor: Actor, projectId: string) {
  await getAccessibleProject(actor, projectId);
  return prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: publicUserSelect } },
    orderBy: { joinedAt: "asc" },
  });
}

export async function addMember(
  actor: Actor,
  projectId: string,
  userId: string,
  role: ProjectMemberRole = "MEMBER",
) {
  assertWrite(actor);
  const project = await getAccessibleProject(actor, projectId);
  assertCanManageProject(actor, project);
  if (role === "OWNER" && actor.role !== "SUPER_ADMIN" && project.userId !== actor.id) {
    throw errors.forbidden();
  }
  const user = await prisma.user.findUnique({
    where: { id: userId, isActive: true },
    select: publicUserSelect,
  });
  if (!user) throw errors.notFound("User");
  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (existing) throw errors.conflict("This user is already a project member.");
  const member = await prisma.projectMember.create({
    data: { projectId, userId, role },
    include: { user: { select: publicUserSelect } },
  });
  const name = actorName(actor);
  void recordActivity({
    type: "PROJECT_MEMBER_ADDED",
    actorId: actor.id,
    userId,
    projectId,
    message: `${name} added ${user.name} to ${project.name}`,
  });
  void notifyUsers({
    userIds: [userId],
    type: "PROJECT_ADDED",
    title: "Added to project",
    body: `You were added to ${project.name}.`,
    actorId: actor.id,
    projectId,
  });
  return member;
}

export async function updateMemberRole(
  actor: Actor,
  projectId: string,
  userId: string,
  role: ProjectMemberRole,
) {
  assertWrite(actor);
  const project = await getAccessibleProject(actor, projectId);
  assertCanManageProject(actor, project);
  if (userId === project.userId && role !== "OWNER") {
    throw errors.badRequest("The project owner must keep the owner role.");
  }
  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!existing) throw errors.notFound("Member");
  return prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role },
    include: { user: { select: publicUserSelect } },
  });
}

export async function removeMember(actor: Actor, projectId: string, userId: string) {
  assertWrite(actor);
  const project = await getAccessibleProject(actor, projectId);
  assertCanManageProject(actor, project);
  if (userId === project.userId) throw errors.badRequest("The project owner cannot be removed.");
  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    include: { user: { select: { name: true } } },
  });
  if (!existing) throw errors.notFound("Member");
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
  const name = actorName(actor);
  void recordActivity({
    type: "PROJECT_MEMBER_REMOVED",
    actorId: actor.id,
    userId,
    projectId,
    message: `${name} removed ${existing.user.name} from ${project.name}`,
  });
  void notifyUsers({
    userIds: [userId],
    type: "PROJECT_MEMBER_REMOVED",
    title: "Removed from project",
    body: `You were removed from ${project.name}.`,
    actorId: actor.id,
    projectId,
    eventId: `project-remove:${projectId}:${userId}`,
  });
  return { ok: true };
}
