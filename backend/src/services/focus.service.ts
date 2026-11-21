import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";

function elapsedSeconds(startedAt: Date, accumulatedSeconds: number) {
  return accumulatedSeconds + Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
}

export async function getActiveSession(userId: string) {
  const session = await prisma.focusSession.findFirst({
    where: { userId, status: { in: ["RUNNING", "PAUSED"] } },
    include: {
      task: {
        include: { project: { select: { id: true, name: true, color: true } } },
      },
    },
    orderBy: { startedAt: "desc" },
  });
  if (!session) return null;
  const liveSeconds =
    session.status === "RUNNING" ? elapsedSeconds(session.updatedAt, session.accumulatedSeconds) : session.accumulatedSeconds;
  return { ...session, liveSeconds };
}

export async function startFocus(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) throw errors.notFound("Task");

  const active = await prisma.focusSession.findMany({
    where: { userId, status: { in: ["RUNNING", "PAUSED"] } },
  });
  if (active.length) {
    await prisma.focusSession.updateMany({
      where: { id: { in: active.map((s) => s.id) } },
      data: { status: "CANCELLED", endedAt: new Date() },
    });
  }

  const session = await prisma.focusSession.create({
    data: {
      userId,
      taskId,
      startedAt: new Date(),
      status: "RUNNING",
      accumulatedSeconds: 0,
    },
    include: { task: { include: { project: { select: { id: true, name: true, color: true } } } } },
  });

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { currentFocusTaskId: taskId } }),
    prisma.task.update({
      where: { id: taskId },
      data: { status: task.status === "DONE" ? task.status : "IN_PROGRESS" },
    }),
  ]);

  return { ...session, liveSeconds: 0 };
}

async function loadOwnedSession(userId: string, id: string) {
  const session = await prisma.focusSession.findFirst({
    where: { id, userId },
    include: { task: { include: { project: { select: { id: true, name: true, color: true } } } } },
  });
  if (!session) throw errors.notFound("Focus session");
  return session;
}

export async function pauseFocus(userId: string, id: string) {
  const session = await loadOwnedSession(userId, id);
  if (session.status !== "RUNNING") throw errors.badRequest("Focus session is not running.");
  const accumulatedSeconds = elapsedSeconds(session.updatedAt, session.accumulatedSeconds);
  const updated = await prisma.focusSession.update({
    where: { id },
    data: { status: "PAUSED", accumulatedSeconds, durationMinutes: Math.floor(accumulatedSeconds / 60) },
    include: { task: { include: { project: { select: { id: true, name: true, color: true } } } } },
  });
  return { ...updated, liveSeconds: accumulatedSeconds };
}

export async function resumeFocus(userId: string, id: string) {
  const session = await loadOwnedSession(userId, id);
  if (session.status !== "PAUSED") throw errors.badRequest("Focus session is not paused.");
  const updated = await prisma.focusSession.update({
    where: { id },
    data: { status: "RUNNING" },
    include: { task: { include: { project: { select: { id: true, name: true, color: true } } } } },
  });
  return { ...updated, liveSeconds: updated.accumulatedSeconds };
}

export async function completeFocus(userId: string, id: string, completeTask = false) {
  const session = await loadOwnedSession(userId, id);
  if (session.status === "COMPLETED" || session.status === "CANCELLED") {
    throw errors.badRequest("Focus session is already closed.");
  }
  const accumulatedSeconds =
    session.status === "RUNNING" ? elapsedSeconds(session.updatedAt, session.accumulatedSeconds) : session.accumulatedSeconds;
  const durationMinutes = Math.max(1, Math.round(accumulatedSeconds / 60));

  const updated = await prisma.focusSession.update({
    where: { id },
    data: {
      status: "COMPLETED",
      endedAt: new Date(),
      accumulatedSeconds,
      durationMinutes,
    },
    include: { task: { include: { project: { select: { id: true, name: true, color: true } } } } },
  });

  const task = await prisma.task.findUnique({ where: { id: session.taskId } });
  await prisma.task.update({
    where: { id: session.taskId },
    data: {
      actualMinutes: (task?.actualMinutes ?? 0) + durationMinutes,
      status: completeTask ? "DONE" : task?.status,
      completedAt: completeTask ? new Date() : task?.completedAt,
    },
  });
  await prisma.user.update({ where: { id: userId }, data: { currentFocusTaskId: null } });
  const { notifyUsers } = await import("../lib/events.js");
  void notifyUsers({
    userIds: [userId],
    type: "FOCUS_COMPLETED",
    title: "Focus session complete",
    body: updated.task?.title ? `Finished focus on ${updated.task.title}.` : "Your focus session finished.",
    taskId: session.taskId,
    eventId: `focus:${id}`,
  });
  return { ...updated, liveSeconds: accumulatedSeconds };
}

export async function cancelFocus(userId: string, id: string) {
  const session = await loadOwnedSession(userId, id);
  const accumulatedSeconds =
    session.status === "RUNNING" ? elapsedSeconds(session.updatedAt, session.accumulatedSeconds) : session.accumulatedSeconds;
  const updated = await prisma.focusSession.update({
    where: { id },
    data: {
      status: "CANCELLED",
      endedAt: new Date(),
      accumulatedSeconds,
      durationMinutes: Math.floor(accumulatedSeconds / 60),
    },
    include: { task: { include: { project: { select: { id: true, name: true, color: true } } } } },
  });
  await prisma.user.update({ where: { id: userId }, data: { currentFocusTaskId: null } });
  return { ...updated, liveSeconds: accumulatedSeconds };
}
