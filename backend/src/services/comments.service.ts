import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import { assertWrite, getAccessibleTask, publicUserSelect, type Actor } from "../lib/access.js";
import { actorName, notifyUsers, recordActivity } from "../lib/events.js";

export async function listComments(actor: Actor, taskId: string) {
  await getAccessibleTask(actor, taskId);
  return prisma.taskComment.findMany({
    where: { taskId },
    include: { user: { select: publicUserSelect } },
    orderBy: { createdAt: "asc" },
  });
}

export async function addComment(actor: Actor, taskId: string, message: string) {
  assertWrite(actor);
  const task = await getAccessibleTask(actor, taskId);
  const comment = await prisma.taskComment.create({
    data: { taskId, userId: actor.id, message: message.trim() },
    include: { user: { select: publicUserSelect } },
  });
  const name = actorName(actor);
  void recordActivity({
    type: "COMMENT_ADDED",
    actorId: actor.id,
    taskId,
    projectId: task.projectId,
    message: `${name} commented on ${task.title}`,
  });
  const assignees = await prisma.taskAssignee.findMany({ where: { taskId }, select: { userId: true } });
  void notifyUsers({
    userIds: [task.userId, ...assignees.map((row) => row.userId)],
    type: "COMMENT_ADDED",
    title: "New comment",
    body: `${name} commented on ${task.title}.`,
    actorId: actor.id,
    taskId,
    projectId: task.projectId,
    eventId: `comment:${comment.id}`,
  });
  const handles = [...message.matchAll(/@([A-Za-z0-9._-]{2,40})/g)].map((match) => match[1].toLowerCase());
  if (handles.length) {
    const people = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: handles.flatMap((handle) => [
          { name: { contains: handle, mode: "insensitive" as const } },
          { email: { startsWith: handle, mode: "insensitive" as const } },
        ]),
      },
      select: { id: true, name: true, email: true },
      take: 30,
    });
    const mentioned = people
      .filter((person) => handles.some((handle) => person.name.toLowerCase().includes(handle) || person.email.toLowerCase().startsWith(handle)))
      .map((person) => person.id);
    void notifyUsers({
      userIds: mentioned,
      type: "TASK_MENTIONED",
      title: "You were mentioned",
      body: `${name} mentioned you on ${task.title}.`,
      actorId: actor.id,
      taskId,
      projectId: task.projectId,
      priority: "High",
      eventId: `mention:${comment.id}`,
    });
    const earlier = await prisma.taskComment.findMany({ where: { taskId, id: { not: comment.id } }, select: { userId: true } });
    const replied = earlier.map((row) => row.userId).filter((id) => mentioned.includes(id));
    void notifyUsers({
      userIds: replied,
      type: "TASK_COMMENT_REPLIED",
      title: "Reply to your comment",
      body: `${name} replied on ${task.title}.`,
      actorId: actor.id,
      taskId,
      projectId: task.projectId,
      eventId: `reply:${comment.id}`,
    });
  }
  return comment;
}

export async function updateComment(actor: Actor, commentId: string, message: string) {
  assertWrite(actor);
  const existing = await prisma.taskComment.findUnique({ where: { id: commentId } });
  if (!existing) throw errors.notFound("Comment");
  if (existing.userId !== actor.id) throw errors.forbidden();
  return prisma.taskComment.update({
    where: { id: commentId },
    data: { message: message.trim() },
    include: { user: { select: publicUserSelect } },
  });
}

export async function deleteComment(actor: Actor, commentId: string) {
  assertWrite(actor);
  const existing = await prisma.taskComment.findUnique({ where: { id: commentId } });
  if (!existing) throw errors.notFound("Comment");
  if (existing.userId !== actor.id && actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") {
    throw errors.forbidden();
  }
  await prisma.taskComment.delete({ where: { id: commentId } });
  return { ok: true };
}
