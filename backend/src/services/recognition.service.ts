import type { RecognitionVisibility } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import { assertAdmin, assertWrite, getAccessibleProject, publicUserSelect, type Actor } from "../lib/access.js";
import { actorName, notifyUsers, recordActivity } from "../lib/events.js";

export async function listRecognition(actor: Actor, projectId?: string) {
  return prisma.recognition.findMany({
    where: projectId ? { projectId } : {},
    include: {
      author: { select: publicUserSelect },
      recipient: { select: publicUserSelect },
      project: { select: { id: true, name: true, color: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createRecognition(
  actor: Actor,
  data: {
    recipientId: string;
    message: string;
    projectId?: string | null;
    taskId?: string | null;
    visibility?: RecognitionVisibility;
  },
) {
  assertWrite(actor);
  assertAdmin(actor);
  const recipient = await prisma.user.findUnique({
    where: { id: data.recipientId, isActive: true },
    select: publicUserSelect,
  });
  if (!recipient) throw errors.notFound("User");
  if (data.projectId) await getAccessibleProject(actor, data.projectId);
  const post = await prisma.recognition.create({
    data: {
      authorId: actor.id,
      recipientId: data.recipientId,
      message: data.message.trim(),
      projectId: data.projectId ?? null,
      taskId: data.taskId ?? null,
      visibility: data.visibility ?? "EVERYONE",
    },
    include: {
      author: { select: publicUserSelect },
      recipient: { select: publicUserSelect },
      project: { select: { id: true, name: true, color: true } },
      task: { select: { id: true, title: true } },
    },
  });
  const name = actorName(actor);
  void recordActivity({
    type: "RECOGNITION_CREATED",
    actorId: actor.id,
    userId: recipient.id,
    projectId: data.projectId,
    taskId: data.taskId,
    message: `${name} recognized ${recipient.name}`,
  });
  void notifyUsers({
    userIds: [recipient.id],
    type: "RECOGNITION",
    title: "You were recognized",
    body: data.message.trim(),
    actorId: actor.id,
    projectId: data.projectId,
    taskId: data.taskId,
  });
  return post;
}
