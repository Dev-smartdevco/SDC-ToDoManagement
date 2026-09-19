import { prisma } from "../lib/prisma.js";
import { errors } from "../lib/httpError.js";
import { type Actor } from "../lib/access.js";

export async function listNotifications(actor: Actor, unreadOnly = false) {
  return prisma.notification.findMany({
    where: { userId: actor.id, readAt: unreadOnly ? null : undefined },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
}

export async function unreadCount(actor: Actor) {
  const count = await prisma.notification.count({ where: { userId: actor.id, readAt: null } });
  return { count };
}

export async function markRead(actor: Actor, id: string) {
  const existing = await prisma.notification.findFirst({ where: { id, userId: actor.id } });
  if (!existing) throw errors.notFound("Notification");
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
