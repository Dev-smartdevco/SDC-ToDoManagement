import type { DevicePlatform, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import type { Actor } from "../lib/access.js";
import { DEFAULT_CATEGORIES, DEFAULT_REMINDERS } from "../lib/notificationPolicy.js";
import { pageResult, pageWindow } from "../lib/paging.js";

export async function listNotifications(
  actor: Actor,
  options: { unread?: boolean; category?: string; page?: number; limit?: number } = {},
) {
  const { page, pageSize, skip } = pageWindow({ page: options.page, pageSize: options.limit });
  const where: Prisma.NotificationWhereInput = {
    userId: actor.id,
    readAt: options.unread ? null : undefined,
    category: options.category || undefined,
  };
  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);
  return pageResult(items, total, page, pageSize);
}

export async function unreadCount(actor: Actor) {
  const count = await prisma.notification.count({ where: { userId: actor.id, readAt: null } });
  return { count };
}

export async function getNotification(actor: Actor, id: string) {
  const existing = await prisma.notification.findFirst({ where: { id, userId: actor.id } });
  if (!existing) throw errors.notFound("Notification");
  return existing;
}

export async function markRead(actor: Actor, id: string) {
  const existing = await getNotification(actor, id);
  return prisma.notification.update({
    where: { id },
    data: { readAt: existing.readAt ?? new Date() },
  });
}

export async function markAllRead(actor: Actor) {
  await prisma.notification.updateMany({
    where: { userId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
}

export async function removeNotification(actor: Actor, id: string) {
  await getNotification(actor, id);
  await prisma.notification.delete({ where: { id } });
  return { ok: true };
}

export async function clearNotifications(actor: Actor) {
  await prisma.notification.deleteMany({ where: { userId: actor.id } });
  return { ok: true };
}

export async function getPreferences(actor: Actor) {
  const row = await prisma.notificationPreference.findUnique({ where: { userId: actor.id } });
  if (!row) {
    return {
      userId: actor.id,
      pushEnabled: true,
      inAppEnabled: true,
      sound: true,
      vibration: true,
      quietStart: null,
      quietEnd: null,
      timeZone: "Africa/Cairo",
      lockScreenPreview: true,
      categories: DEFAULT_CATEGORIES,
      reminders: DEFAULT_REMINDERS,
    };
  }
  return row;
}

export async function savePreferences(actor: Actor, data: Record<string, unknown>) {
  const current = await getPreferences(actor);
  const categories = { ...(current.categories as object), ...((data.categories as object) ?? {}) };
  const reminders = { ...(current.reminders as object), ...((data.reminders as object) ?? {}) };
  return prisma.notificationPreference.upsert({
    where: { userId: actor.id },
    update: {
      pushEnabled: bool(data.pushEnabled, current.pushEnabled),
      inAppEnabled: bool(data.inAppEnabled, current.inAppEnabled),
      sound: bool(data.sound, current.sound),
      vibration: bool(data.vibration, current.vibration),
      quietStart: data.quietStart === undefined ? current.quietStart : (data.quietStart as string | null),
      quietEnd: data.quietEnd === undefined ? current.quietEnd : (data.quietEnd as string | null),
      timeZone: typeof data.timeZone === "string" ? data.timeZone : current.timeZone,
      lockScreenPreview: bool(data.lockScreenPreview, current.lockScreenPreview),
      categories,
      reminders,
    },
    create: {
      userId: actor.id,
      pushEnabled: bool(data.pushEnabled, true),
      inAppEnabled: bool(data.inAppEnabled, true),
      sound: bool(data.sound, true),
      vibration: bool(data.vibration, true),
      quietStart: (data.quietStart as string | null) ?? null,
      quietEnd: (data.quietEnd as string | null) ?? null,
      timeZone: typeof data.timeZone === "string" ? data.timeZone : "Africa/Cairo",
      lockScreenPreview: bool(data.lockScreenPreview, true),
      categories,
      reminders,
    },
  });
}

export async function registerDevice(
  actor: Actor,
  input: { token: string; platform: DevicePlatform; name?: string | null },
) {
  const token = input.token.trim();
  if (!token || token.length > 4096) throw errors.badRequest("Device token is required.");
  const existing = await prisma.device.findUnique({ where: { token } });
  const device = existing
    ? await prisma.device.update({
        where: { token },
        data: { userId: actor.id, platform: input.platform, name: input.name ?? existing.name, active: true, lastSeenAt: new Date() },
      })
    : await prisma.device.create({
        data: { userId: actor.id, token, platform: input.platform, name: input.name ?? null },
      });
  return { id: device.id, platform: device.platform, name: device.name, active: device.active };
}

export async function removeDevice(actor: Actor, id: string) {
  const device = await prisma.device.findFirst({ where: { id, userId: actor.id } });
  if (!device) throw errors.notFound("Device");
  await prisma.device.update({ where: { id }, data: { active: false } });
  return { ok: true };
}

export async function removeDeviceByToken(actor: Actor, token: string) {
  const value = token.trim();
  if (!value || value.length > 4096) throw errors.badRequest("Device token is required.");
  const device = await prisma.device.findUnique({ where: { token: value } });
  if (!device) return { ok: true };
  if (device.userId !== actor.id) throw errors.notFound("Device");
  await prisma.device.update({ where: { id: device.id }, data: { active: false } });
  return { ok: true };
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}
