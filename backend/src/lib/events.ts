import type { ActivityType, NotificationType, Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import type { Actor } from "./access.js";
import { dispatchNotification } from "../services/notificationEngine.js";

export async function recordActivity(input: {
  type: ActivityType;
  actorId: string;
  message: string;
  userId?: string | null;
  taskId?: string | null;
  projectId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    return await prisma.activityLog.create({
      data: {
        type: input.type,
        actorId: input.actorId,
        message: input.message,
        userId: input.userId ?? null,
        taskId: input.taskId ?? null,
        projectId: input.projectId ?? null,
        metadata: input.metadata,
      },
    });
  } catch {
    return null;
  }
}

export async function notifyUsers(input: {
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
}) {
  try {
    await dispatchNotification(input);
  } catch (error) {
    console.error("notifyUsers", error instanceof Error ? error.message : error);
  }
}

export function actorName(actor: Pick<Actor, "email" | "name">, fallback = "Someone") {
  return actor.name || actor.email || fallback;
}
