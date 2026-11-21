import { createHash, randomUUID } from "node:crypto";
import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_REMINDERS,
  allowsInApp,
  allowsPush,
  categoryFor,
  deepLinkFor,
  deliveryOutcome,
  fcmData,
  isSecurity,
  nextQuietEnd,
  quietHoursActive,
} from "../lib/notificationPolicy.js";
import { sendFcm } from "./push.service.js";

export type NotifyInput = {
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  actorId?: string;
  taskId?: string | null;
  projectId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  priority?: "Low" | "Normal" | "High";
  eventId?: string;
  metadata?: Prisma.InputJsonValue;
};

function stableEventId(input: NotifyInput, userId: string) {
  if (input.eventId) return `${input.eventId}:${userId}`;
  return createHash("sha256")
    .update(`${input.type}|${input.taskId ?? ""}|${input.projectId ?? ""}|${input.entityId ?? ""}|${userId}|${input.title}|${input.body}`)
    .digest("hex");
}

async function preference(userId: string) {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } });
  return {
    pushEnabled: row?.pushEnabled ?? true,
    inAppEnabled: row?.inAppEnabled ?? true,
    sound: row?.sound ?? true,
    vibration: row?.vibration ?? true,
    quietStart: row?.quietStart ?? null,
    quietEnd: row?.quietEnd ?? null,
    timeZone: row?.timeZone ?? "Africa/Cairo",
    lockScreenPreview: row?.lockScreenPreview ?? true,
    categories: (row?.categories as Record<string, boolean> | null) ?? DEFAULT_CATEGORIES,
    reminders: (row?.reminders as Record<string, unknown> | null) ?? DEFAULT_REMINDERS,
  };
}

export async function dispatchNotification(input: NotifyInput) {
  const unique = [...new Set(input.userIds)].filter((id) => id && id !== input.actorId);
  const category = categoryFor(input.type);
  const entityType = input.entityType ?? (input.taskId ? "Task" : input.projectId ? "Project" : null);
  const entityId = input.entityId ?? input.taskId ?? input.projectId ?? null;
  const deepLink = deepLinkFor(entityType, entityId, input.taskId, input.projectId);
  for (const userId of unique) {
    const prefs = await preference(userId);
    if (!allowsInApp(prefs.categories, input.type, prefs.inAppEnabled)) continue;
    const eventId = stableEventId(input, userId);
    const duplicate = await prisma.notification.findUnique({ where: { eventId }, select: { id: true } });
    if (duplicate) continue;
    try {
      const saved = await prisma.notification.create({
        data: {
          userId,
          type: input.type,
          category,
          title: input.title,
          body: input.body,
          actorId: input.actorId ?? null,
          taskId: input.taskId ?? null,
          projectId: input.projectId ?? null,
          entityType,
          entityId,
          deepLink,
          priority: input.priority ?? (isSecurity(input.type) ? "High" : "Normal"),
          eventId,
          metadata: input.metadata,
        },
      });
      await queuePush(
        saved.id,
        userId,
        prefs,
        fcmData({
          notificationId: saved.id,
          type: input.type,
          category,
          title: input.title,
          body: input.body,
          entityType,
          entityId,
          taskId: input.taskId,
          projectId: input.projectId,
          deepLink,
          priority: saved.priority,
          sound: prefs.sound ? "true" : "false",
          lockScreenPreview: prefs.lockScreenPreview ? "true" : "false",
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("Unique constraint")) {
        console.error("notification.persist", input.type, message);
      }
    }
  }
}

async function queuePush(notificationId: string, userId: string, prefs: Awaited<ReturnType<typeof preference>>, data: Record<string, string>) {
  if (!allowsPush(prefs.categories, data.type, prefs.pushEnabled)) {
    await prisma.notificationDelivery.create({
      data: { notificationId, status: "SKIPPED", lastError: "Push disabled by preference" },
    });
    return;
  }
  const quiet = quietHoursActive(new Date(), prefs.quietStart, prefs.quietEnd, prefs.timeZone) && !isSecurity(data.type);
  const devices = await prisma.device.findMany({ where: { userId, active: true } });
  if (!devices.length) {
    await prisma.notificationDelivery.create({
      data: { notificationId, status: "SKIPPED", lastError: "No active device token" },
    });
    return;
  }
  const unread = await prisma.notification.count({ where: { userId, readAt: null } });
  for (const device of devices) {
    try {
      const delivery = await prisma.notificationDelivery.create({
        data: {
          notificationId,
          deviceId: device.id,
          status: "PENDING",
          nextAttemptAt: quiet && prefs.quietEnd ? nextQuietEnd(new Date(), prefs.quietEnd, prefs.timeZone) : new Date(),
        },
      });
      if (!quiet) await attemptDelivery(delivery.id, device.token, device.id, data, unread);
    } catch (error) {
      console.error("notification.device", error instanceof Error ? error.message : "Push delivery failed");
    }
  }
}

export async function attemptDelivery(deliveryId: string, token: string, deviceId: string, data: Record<string, string>, badge: number) {
  const current = await prisma.notificationDelivery.findUnique({ where: { id: deliveryId }, select: { attempts: true } });
  let result: { ok: boolean; invalid: boolean; error: string | null };
  try {
    result = await sendFcm(token, data, badge);
  } catch (error) {
    result = { ok: false, invalid: false, error: error instanceof Error ? error.message : "Push delivery failed" };
  }
  const outcome = deliveryOutcome({ ...result, attempts: current?.attempts ?? 0 });
  if (outcome.deactivate) {
    await prisma.device.update({ where: { id: deviceId }, data: { active: false } });
  }
  await prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: outcome.status,
      attempts: outcome.status === "SENT" ? current?.attempts ?? 0 : outcome.attempts,
      lastError: outcome.error,
      nextAttemptAt: outcome.status === "PENDING" ? new Date(Date.now() + outcome.delayMs) : undefined,
    },
  });
}

export async function claimDelivery(id: string) {
  const claimed = await prisma.notificationDelivery.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "PROCESSING" },
  });
  return claimed.count === 1;
}

export async function processDeliveryQueue() {
  const staleBefore = new Date(Date.now() - 2 * 60_000);
  await prisma.notificationDelivery.updateMany({
    where: { status: "PROCESSING", updatedAt: { lt: staleBefore } },
    data: { status: "PENDING" },
  });
  const due = await prisma.notificationDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() }, deviceId: { not: null } },
    orderBy: { nextAttemptAt: "asc" },
    take: 40,
    include: { notification: true },
  });
  let processed = 0;
  for (const row of due) {
    if (!row.deviceId) continue;
    if (!(await claimDelivery(row.id))) continue;
    processed += 1;
    const device = await prisma.device.findUnique({ where: { id: row.deviceId } });
    if (!device || !device.active) {
      await prisma.notificationDelivery.update({ where: { id: row.id }, data: { status: "DEAD", lastError: "Device inactive" } });
      continue;
    }
    const unread = await prisma.notification.count({ where: { userId: row.notification.userId, readAt: null } });
    try {
      await attemptDelivery(
        row.id,
        device.token,
        device.id,
        fcmData({
          notificationId: row.notification.id,
          type: row.notification.type,
          category: row.notification.category,
          title: row.notification.title,
          body: row.notification.body,
          entityType: row.notification.entityType,
          entityId: row.notification.entityId,
          taskId: row.notification.taskId,
          projectId: row.notification.projectId,
          deepLink: row.notification.deepLink,
          priority: row.notification.priority,
          sound: "true",
          lockScreenPreview: "true",
        }),
        unread,
      );
    } catch (error) {
      console.error("notification.retry", error instanceof Error ? error.message : "Push delivery failed");
      await prisma.notificationDelivery.update({
        where: { id: row.id },
        data: { status: "PENDING", nextAttemptAt: new Date(Date.now() + 60_000), lastError: "Retry failed" },
      });
    }
  }
  return processed;
}

export async function scheduleReminder(input: {
  eventId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  fireAt: Date;
  taskId?: string | null;
  projectId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}) {
  if (input.fireAt.getTime() < Date.now() - 60_000) return;
  await prisma.scheduledReminder.upsert({
    where: { eventId: input.eventId },
    update: { fireAt: input.fireAt, title: input.title, body: input.body, cancelled: false, sent: false },
    create: {
      eventId: input.eventId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      fireAt: input.fireAt,
      taskId: input.taskId ?? null,
      projectId: input.projectId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      deepLink: deepLinkFor(input.entityType, input.entityId, input.taskId, input.projectId),
    },
  });
}

export async function cancelTaskReminders(taskId: string) {
  await prisma.scheduledReminder.updateMany({ where: { taskId, sent: false }, data: { cancelled: true } });
}

export async function processReminders() {
  const due = await prisma.scheduledReminder.findMany({
    where: { sent: false, cancelled: false, fireAt: { lte: new Date() } },
    take: 40,
  });
  for (const row of due) {
    if (row.taskId) {
      const task = await prisma.task.findUnique({ where: { id: row.taskId }, select: { status: true } });
      if (!task || task.status === "DONE" || task.status === "CANCELLED") {
        await prisma.scheduledReminder.update({ where: { id: row.id }, data: { cancelled: true } });
        continue;
      }
    }
    await dispatchNotification({
      userIds: [row.userId],
      type: row.type,
      title: row.title,
      body: row.body,
      taskId: row.taskId,
      projectId: row.projectId,
      entityType: row.entityType,
      entityId: row.entityId,
      eventId: row.eventId,
    });
    await prisma.scheduledReminder.update({ where: { id: row.id }, data: { sent: true } });
  }
}

function atTime(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hour ?? 9, minute ?? 0, 0, 0);
}

export async function syncTaskReminders(task: { id: string; title: string; dueDate: string | null; dueTime: string | null; status: string; userId: string; projectId: string | null }, assigneeIds: string[]) {
  if (!task.dueDate || task.status === "DONE" || task.status === "CANCELLED") {
    await cancelTaskReminders(task.id);
    return;
  }
  const due = atTime(task.dueDate, task.dueTime ?? "09:00");
  const recipients = [...new Set([task.userId, ...assigneeIds])];
  for (const userId of recipients) {
    const prefs = await preference(userId);
    const reminders = prefs.reminders;
    const slots: Array<[string, boolean, number]> = [
      ["24h", reminders.task24h !== false, 24 * 60 * 60_000],
      ["1h", reminders.task1h !== false, 60 * 60_000],
      ["due", reminders.taskAtDeadline !== false, 0],
    ];
    for (const [key, enabled, before] of slots) {
      if (!enabled) continue;
      await scheduleReminder({
        eventId: `task:${task.id}:${key}:${userId}`,
        userId,
        type: "TASK_REMINDER",
        title: key === "due" ? "Task deadline" : "Task reminder",
        body: task.title,
        fireAt: new Date(due.getTime() - before),
        taskId: task.id,
        projectId: task.projectId,
        entityType: "Task",
        entityId: task.id,
      });
    }
  }
}

export async function scanOverdue() {
  const today = new Date().toISOString().slice(0, 10);
  const tasks = await prisma.task.findMany({
    where: { dueDate: { lt: today, not: null }, status: { in: ["INBOX", "TODO", "IN_PROGRESS", "BLOCKED"] }, parentTaskId: null },
    select: { id: true, title: true, userId: true, projectId: true, assignees: { select: { userId: true } } },
    take: 80,
  });
  for (const task of tasks) {
    await dispatchNotification({
      userIds: [task.userId, ...task.assignees.map((row) => row.userId)],
      type: "TASK_OVERDUE",
      title: "Task overdue",
      body: task.title,
      taskId: task.id,
      projectId: task.projectId,
      priority: "High",
      eventId: `overdue:${task.id}:${today}`,
    });
  }
}

function localMinutes(now: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
    return { minutes: hour * 60 + minute, weekday };
  } catch {
    return { minutes: now.getUTCHours() * 60 + now.getUTCMinutes(), weekday: "" };
  }
}

function clockHit(value: unknown, minutesNow: number) {
  const [hour, minute] = String(value ?? "").split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const target = hour * 60 + minute;
  return minutesNow >= target && minutesNow < target + 2;
}

async function scanDaily() {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true }, take: 150 });
  for (const user of users) {
    const prefs = await preference(user.id);
    const local = localMinutes(now, prefs.timeZone);
    const reminders = prefs.reminders;
    if (clockHit(reminders.dailyPlanTime, local.minutes)) {
      await dispatchNotification({
        userIds: [user.id],
        type: "DAILY_PLAN",
        title: "Daily plan",
        body: "Review today's priorities.",
        eventId: `daily:${user.id}:${day}`,
      });
      await dispatchNotification({
        userIds: [user.id],
        type: "START_OF_DAY",
        title: "Start of day",
        body: "Your priorities for today are ready.",
        eventId: `start:${user.id}:${day}`,
      });
    }
    if (clockHit(reminders.dailyReviewTime, local.minutes)) {
      await dispatchNotification({
        userIds: [user.id],
        type: "END_OF_DAY",
        title: "End of day review",
        body: "Review what you finished and what is still open.",
        eventId: `eod:${user.id}:${day}`,
      });
      const open = await prisma.task.count({
        where: { userId: user.id, parentTaskId: null, status: { notIn: ["DONE", "CANCELLED"] } },
      });
      if (open > 0) {
        await dispatchNotification({
          userIds: [user.id],
          type: "INCOMPLETE_TASKS",
          title: "Unfinished tasks",
          body: `${open} task${open === 1 ? "" : "s"} still open.`,
          eventId: `open:${user.id}:${day}`,
        });
      }
    }
    const weeklyDay = Number(reminders.weeklyReviewDay ?? 5);
    if (local.weekday.startsWith(weekdays[weeklyDay] ?? "Fri") && clockHit(reminders.weeklyReviewTime, local.minutes)) {
      await dispatchNotification({
        userIds: [user.id],
        type: "WEEKLY_REVIEW",
        title: "Weekly review",
        body: "Complete your weekly review.",
        eventId: `week:${user.id}:${day}`,
      });
    }
  }
}

export function startNotificationWorkers() {
  const tick = async () => {
    try {
      await processDeliveryQueue();
      await processReminders();
      await scanOverdue();
      await scanDaily();
    } catch (error) {
      console.error("notification.worker", error instanceof Error ? error.message : error);
    }
  };
  const timer = setInterval(() => void tick(), 60_000);
  timer.unref?.();
  void tick();
  return () => clearInterval(timer);
}

export function newDeviceId() {
  return randomUUID();
}
