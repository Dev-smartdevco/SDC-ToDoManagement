import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";

export async function listTimeBlocks(userId: string, date: string) {
  return prisma.timeBlock.findMany({
    where: { userId, date },
    orderBy: { startTime: "asc" },
    include: {
      project: { select: { id: true, name: true, color: true } },
      task: { select: { id: true, title: true } },
    },
  });
}

export async function createTimeBlock(
  userId: string,
  data: {
    title: string;
    projectId?: string | null;
    taskId?: string | null;
    date: string;
    startTime: string;
    endTime: string;
    notes?: string | null;
  },
) {
  if (data.endTime <= data.startTime) {
    throw errors.badRequest("End time must be after start time.");
  }
  return prisma.timeBlock.create({
    data: {
      userId,
      title: data.title,
      projectId: data.projectId ?? null,
      taskId: data.taskId ?? null,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      notes: data.notes ?? null,
    },
    include: {
      project: { select: { id: true, name: true, color: true } },
      task: { select: { id: true, title: true } },
    },
  });
}

export async function updateTimeBlock(
  userId: string,
  id: string,
  data: {
    title?: string;
    projectId?: string | null;
    taskId?: string | null;
    date?: string;
    startTime?: string;
    endTime?: string;
    notes?: string | null;
  },
) {
  const existing = await prisma.timeBlock.findFirst({ where: { id, userId } });
  if (!existing) throw errors.notFound("Meeting");
  const startTime = data.startTime ?? existing.startTime;
  const endTime = data.endTime ?? existing.endTime;
  if (endTime <= startTime) throw errors.badRequest("End time must be after start time.");
  return prisma.timeBlock.update({
    where: { id },
    data,
    include: {
      project: { select: { id: true, name: true, color: true } },
      task: { select: { id: true, title: true } },
    },
  });
}

export async function deleteTimeBlock(userId: string, id: string) {
  const existing = await prisma.timeBlock.findFirst({ where: { id, userId } });
  if (!existing) throw errors.notFound("Meeting");
  await prisma.timeBlock.delete({ where: { id } });
  return { ok: true };
}
