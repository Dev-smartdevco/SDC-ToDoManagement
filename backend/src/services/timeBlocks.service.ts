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
    participantIds?: string[];
  },
) {
  if (data.endTime <= data.startTime) {
    throw errors.badRequest("End time must be after start time.");
  }
  const created = await prisma.timeBlock.create({
    data: {
      userId,
      title: data.title,
      projectId: data.projectId ?? null,
      taskId: data.taskId ?? null,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      notes: data.notes ?? null,
      participantIds: data.participantIds ?? [],
    },
    include: {
      project: { select: { id: true, name: true, color: true } },
      task: { select: { id: true, title: true } },
    },
  });
  if (data.participantIds?.length) {
    const { notifyUsers } = await import("../lib/events.js");
    void notifyUsers({
      userIds: data.participantIds,
      type: "MEETING_INVITATION",
      title: "Meeting invitation",
      body: data.title,
      projectId: data.projectId ?? null,
      entityType: "Meeting",
      entityId: created.id,
      eventId: `meeting:${created.id}`,
    });
  }
  await syncMeetingReminders(created);
  return created;
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
  const updated = await prisma.timeBlock.update({
    where: { id },
    data,
    include: {
      project: { select: { id: true, name: true, color: true } },
      task: { select: { id: true, title: true } },
    },
  });
  const { notifyUsers } = await import("../lib/events.js");
  void notifyUsers({
    userIds: updated.participantIds,
    type: "MEETING_UPDATED",
    title: "Meeting updated",
    body: updated.title,
    projectId: updated.projectId,
    entityType: "Meeting",
    entityId: updated.id,
    eventId: `meeting-update:${updated.id}:${updated.date}:${updated.startTime}`,
  });
  await syncMeetingReminders(updated);
  return updated;
}

export async function deleteTimeBlock(userId: string, id: string) {
  const existing = await prisma.timeBlock.findFirst({ where: { id, userId } });
  if (!existing) throw errors.notFound("Meeting");
  const { notifyUsers } = await import("../lib/events.js");
  void notifyUsers({
    userIds: existing.participantIds,
    type: "MEETING_CANCELLED",
    title: "Meeting cancelled",
    body: existing.title,
    projectId: existing.projectId,
    entityType: "Meeting",
    entityId: existing.id,
    eventId: `meeting-cancel:${existing.id}`,
  });
  await prisma.scheduledReminder.updateMany({ where: { entityId: id, sent: false }, data: { cancelled: true } });
  await prisma.timeBlock.delete({ where: { id } });
  return { ok: true };
}

function meetingStart(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hour ?? 9, minute ?? 0);
}

async function syncMeetingReminders(block: {
  id: string;
  title: string;
  date: string;
  startTime: string;
  userId: string;
  projectId: string | null;
  participantIds: string[];
}) {
  const { scheduleReminder } = await import("./notificationEngine.js");
  const start = meetingStart(block.date, block.startTime);
  const people = [...new Set([block.userId, ...block.participantIds])];
  for (const personId of people) {
    const slots = [
      ["24h", "Meeting tomorrow", start.getTime() - 24 * 60 * 60_000, "MEETING_REMINDER"],
      ["15m", "Meeting in 15 minutes", start.getTime() - 15 * 60_000, "MEETING_REMINDER"],
      ["start", "Meeting starting", start.getTime(), "MEETING_STARTING"],
    ] as const;
    for (const [key, title, at, type] of slots) {
      await scheduleReminder({
        eventId: `meet:${block.id}:${key}:${personId}`,
        userId: personId,
        type,
        title,
        body: block.title,
        fireAt: new Date(at),
        projectId: block.projectId,
        entityType: "Meeting",
        entityId: block.id,
      });
    }
  }
}
