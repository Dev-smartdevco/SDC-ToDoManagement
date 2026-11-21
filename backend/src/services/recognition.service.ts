import type { RecognitionVisibility } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import { assertAdmin, assertWrite, getAccessibleProject, publicUserSelect, type Actor } from "../lib/access.js";
import { actorName, notifyUsers, recordActivity } from "../lib/events.js";
import { pageResult, pageWindow } from "../lib/paging.js";

export async function listRecognition(
  _actor: Actor,
  query: { projectId?: string; page?: number; limit?: number; pageSize?: number } = {},
) {
  const { page, pageSize, skip } = pageWindow(query);
  const where = { projectId: query.projectId || undefined };
  const [items, total] = await Promise.all([
    prisma.recognition.findMany({
      where,
      relationLoadStrategy: "join",
      include: {
        author: { select: publicUserSelect },
        recipient: { select: publicUserSelect },
        project: { select: { id: true, name: true, color: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.recognition.count({ where }),
  ]);
  return pageResult(items, total, page, pageSize);
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
