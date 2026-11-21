import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import {
  assertWrite,
  getAccessibleProject,
  getAccessibleTask,
  publicUserSelect,
  type Actor,
} from "../lib/access.js";

function serializeFile(file: {
  id: string;
  title: string;
  url: string;
  createdAt: Date;
  user: { id: string; name: string; email: string };
}) {
  return file;
}

export async function listProjectFiles(actor: Actor, projectId: string) {
  await getAccessibleProject(actor, projectId);
  return prisma.fileLink.findMany({
    where: { projectId },
    include: { user: { select: publicUserSelect } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listTaskFiles(actor: Actor, taskId: string) {
  await getAccessibleTask(actor, taskId);
  return prisma.fileLink.findMany({
    where: { taskId },
    include: { user: { select: publicUserSelect } },
    orderBy: { createdAt: "desc" },
  });
}

export async function addFile(
  actor: Actor,
  data: { title: string; url: string; projectId?: string | null; taskId?: string | null },
) {
  assertWrite(actor);
  if (!data.projectId && !data.taskId) throw errors.badRequest("A project or task is required.");
  if (data.projectId) await getAccessibleProject(actor, data.projectId);
  if (data.taskId) {
    const task = await getAccessibleTask(actor, data.taskId);
    data.projectId = data.projectId ?? task.projectId;
  }
  const created = await prisma.fileLink.create({
    data: {
      userId: actor.id,
      title: data.title.trim(),
      url: data.url.trim(),
      projectId: data.projectId ?? null,
      taskId: data.taskId ?? null,
    },
    include: { user: { select: publicUserSelect } },
  });
  if (data.taskId) {
    const task = await prisma.task.findUnique({
      where: { id: data.taskId },
      include: { assignees: { select: { userId: true } } },
    });
    if (task) {
      const { notifyUsers } = await import("../lib/events.js");
      void notifyUsers({
        userIds: [task.userId, ...task.assignees.map((row) => row.userId)],
        type: "TASK_ATTACHMENT_ADDED",
        title: "Attachment added",
        body: created.title,
        actorId: actor.id,
        taskId: task.id,
        projectId: task.projectId,
        eventId: `file:${created.id}`,
      });
    }
  }
  return created;
}

export async function deleteFile(actor: Actor, id: string) {
  assertWrite(actor);
  const existing = await prisma.fileLink.findUnique({ where: { id } });
  if (!existing) throw errors.notFound("File");
  if (existing.userId !== actor.id && actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") {
    throw errors.forbidden();
  }
  await prisma.fileLink.delete({ where: { id } });
  return { ok: true };
}

export { serializeFile };
